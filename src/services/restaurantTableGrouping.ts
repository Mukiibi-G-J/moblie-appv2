import type {RestaurantFloor, RestaurantTable} from './restaurantApi';

export interface SectionGroup {
  sectionId: number | null;
  sectionName: string;
  tables: RestaurantTable[];
}

export interface FloorGroup {
  floorId: number;
  floorName: string;
  sections: SectionGroup[];
}

export function sortFloorsByDisplayOrder(
  floors: RestaurantFloor[],
): RestaurantFloor[] {
  return [...floors].sort((a, b) => {
    if (a.display_order !== b.display_order) {
      return a.display_order - b.display_order;
    }
    return a.id - b.id;
  });
}

/** Group tables for one floor into sections (matches web Tables / POS overview). */
export function groupTablesByFloorAndSection(
  tables: RestaurantTable[],
  floors: RestaurantFloor[],
  activeFloorId: number,
): FloorGroup[] {
  const sortedFloors = sortFloorsByDisplayOrder(floors);
  const floorsToShow = sortedFloors.filter(f => f.id === activeFloorId);

  return floorsToShow.map(floor => {
    const floorTables = tables.filter(t => t.floor === floor.id);
    const sectionMap = new Map<
      string,
      {sectionId: number | null; sectionName: string; tables: RestaurantTable[]}
    >();

    for (const t of floorTables) {
      const key = t.section != null ? `id:${t.section}` : 'none';
      if (!sectionMap.has(key)) {
        sectionMap.set(key, {
          sectionId: t.section ?? null,
          sectionName:
            t.section == null
              ? 'Unassigned'
              : (t.section_name?.trim() || `Section ${t.section}`),
          tables: [],
        });
      }
      const entry = sectionMap.get(key)!;
      if (t.section != null) {
        const name = t.section_name?.trim();
        if (name && /^Section \d+$/.test(entry.sectionName)) {
          entry.sectionName = name;
        }
      }
      entry.tables.push(t);
    }

    const sections = Array.from(sectionMap.values()).sort((a, b) => {
      if (a.sectionId == null && b.sectionId == null) {
        return 0;
      }
      if (a.sectionId == null) {
        return 1;
      }
      if (b.sectionId == null) {
        return -1;
      }
      return a.sectionId - b.sectionId;
    });

    return {
      floorId: floor.id,
      floorName: floor.name,
      sections,
    };
  });
}

/** When no floors exist, show every table under one heading. */
export function singleGroupAllTables(tables: RestaurantTable[]): FloorGroup[] {
  if (tables.length === 0) {
    return [];
  }
  return [
    {
      floorId: 0,
      floorName: 'Tables',
      sections: [
        {
          sectionId: null,
          sectionName: 'All tables',
          tables: [...tables],
        },
      ],
    },
  ];
}
