import {resolveCanManageCompany} from '../companyAccess';

describe('resolveCanManageCompany', () => {
  it('denies when auth is missing', () => {
    expect(resolveCanManageCompany(null)).toBe(false);
    expect(resolveCanManageCompany(undefined)).toBe(false);
  });

  it('grants superuser and SUPER permission', () => {
    expect(resolveCanManageCompany({is_superuser: true})).toBe(true);
    expect(resolveCanManageCompany({has_super_permission: true})).toBe(true);
  });

  it('uses the JWT canManageCompany claim and ignores Admin role', () => {
    expect(
      resolveCanManageCompany({
        userPermissions: {canManageCompany: true},
      }),
    ).toBe(true);
    expect(
      resolveCanManageCompany({
        userPermissions: {canManageCompany: false},
        page_permissions: {
          'Company Management': {
            read: true,
            insert: true,
            modify: true,
            delete: true,
          },
        },
      }),
    ).toBe(false);
  });

  it('falls back to explicit company page grants when the claim is absent', () => {
    expect(
      resolveCanManageCompany({
        page_permissions: {
          CompanyCard: {read: true, insert: false, modify: false, delete: false},
        },
      }),
    ).toBe(true);
    expect(
      resolveCanManageCompany({
        page_permissions: {
          Sales: {read: true, insert: true, modify: true, delete: false},
        },
      }),
    ).toBe(false);
  });

  it('does not treat a missing page_permissions key as allowed', () => {
    expect(resolveCanManageCompany({page_permissions: {}})).toBe(false);
  });
});
