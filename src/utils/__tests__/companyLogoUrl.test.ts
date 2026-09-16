jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/tmp',
  downloadFile: () => ({promise: Promise.resolve({statusCode: 200})}),
  exists: () => Promise.resolve(false),
  stat: () => Promise.resolve({size: 1}),
  unlink: () => Promise.resolve(),
}));
jest.mock('../../axios/axios', () => ({
  createAxiosInstance: () => ({
    defaults: {baseURL: 'https://zentroapp-backend.com'},
  }),
}));

import {
  extractCompanyLogo,
  isPlaceholderCompanyLogo,
} from '../companyLogoUrl';

describe('companyLogoUrl', () => {
  it('reads the company-info logo string', () => {
    expect(
      extractCompanyLogo({
        logo: '/media/company_logos/adrace.png',
      }),
    ).toBe('/media/company_logos/adrace.png');
  });

  it('reads nested {url} and logoUrl', () => {
    expect(extractCompanyLogo({logo: {url: 'https://cdn.example/a.png'}})).toBe(
      'https://cdn.example/a.png',
    );
    expect(extractCompanyLogo({logoUrl: 'https://cdn.example/b.png'})).toBe(
      'https://cdn.example/b.png',
    );
  });

  it('skips the Django default placeholder', () => {
    expect(isPlaceholderCompanyLogo('company_logos/default.png')).toBe(true);
    expect(
      isPlaceholderCompanyLogo(
        'https://zentroapp-backend.com/media/company_logos/default.png',
      ),
    ).toBe(true);
    expect(
      isPlaceholderCompanyLogo('/media/company_logos/adrace.png'),
    ).toBe(false);
  });
});
