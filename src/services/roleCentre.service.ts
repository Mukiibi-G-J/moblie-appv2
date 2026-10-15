import {
  PAGE_IDS,
  fetchPageDataRecord,
  fetchPageRelations,
  getSetupSoloSystemId,
  resolvePageFieldRef,
  updatePageDataField,
  type PageRelationOption,
} from './pageDataService';

export type ApplicationProfileOption = {
  code: string;
  description: string;
};

export type RoleCentreSettings = {
  systemId: string;
  currentCode: string | null;
  currentDescription: string | null;
  profiles: ApplicationProfileOption[];
  /** True when more than one profile is available (typically SUPER / admin). */
  canSwitch: boolean;
};

function asString(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function mapProfiles(options: PageRelationOption[]): ApplicationProfileOption[] {
  const seen = new Set<string>();
  const out: ApplicationProfileOption[] = [];
  for (const opt of options) {
    const code = asString(opt.code) || asString(opt.value);
    if (!code || seen.has(code)) {
      continue;
    }
    seen.add(code);
    out.push({
      code,
      description: asString(opt.caption) || code,
    });
  }
  return out.sort((a, b) =>
    a.description.localeCompare(b.description, undefined, {sensitivity: 'base'}),
  );
}

/**
 * Load User Settings Role Centre options.
 * Backend filters ApplicationProfiles the same as webV2:
 * SUPER / superuser see all; others only profiles they may use.
 */
export async function loadRoleCentreSettings(): Promise<RoleCentreSettings> {
  const pageId = PAGE_IDS.UserSettingsCard;
  const systemId = await getSetupSoloSystemId(pageId);
  const fieldRef = await resolvePageFieldRef(pageId, 'role');
  if (!fieldRef) {
    throw new Error('Role Centre field is not available on this company');
  }

  const record = await fetchPageDataRecord(pageId, systemId, fieldRef.pageControlId);
  const currentCode = asString(record.role);
  const currentDescription =
    asString(record.role_display) ||
    asString(record.role_Description) ||
    asString(record.role_description) ||
    null;

  const relationOptions = await fetchPageRelations({
    pageId,
    pageControlId: fieldRef.pageControlId,
    pageControlFieldId: fieldRef.pageControlFieldId,
    currentRecordSystemId: systemId,
    currentRecordValues: {
      role: currentCode,
      user_id: record.user_id ?? record.user__username ?? null,
    },
  });

  let profiles = mapProfiles(relationOptions);

  // Always keep the current profile visible so the picker never blanks out.
  if (currentCode && !profiles.some(p => p.code === currentCode)) {
    profiles = [
      {
        code: currentCode,
        description: currentDescription || currentCode,
      },
      ...profiles,
    ];
  }

  const matched = currentCode
    ? profiles.find(p => p.code === currentCode)
    : undefined;

  return {
    systemId,
    currentCode,
    currentDescription: matched?.description ?? currentDescription,
    profiles,
    canSwitch: profiles.length > 1,
  };
}

/** PATCH User Settings `role` (Application Profile code), same as web Role Centre save. */
export async function switchRoleCentre(
  systemId: string,
  profileCode: string,
  currentRecordValues?: Record<string, unknown>,
): Promise<void> {
  const code = profileCode.trim();
  if (!code) {
    throw new Error('Select a Role Centre profile');
  }
  await updatePageDataField({
    pageId: PAGE_IDS.UserSettingsCard,
    systemId,
    field: 'role',
    value: code,
    currentRecordValues,
  });
}
