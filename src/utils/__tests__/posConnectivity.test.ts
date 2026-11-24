import {
  getEffectiveIsOnline,
  isCheckoutNetworkFailure,
  setNetInfoConnected,
  setServerReachable,
} from '../posConnectivity';

jest.mock('../../services/sync/SyncApi', () => ({
  __esModule: true,
  default: {ping: jest.fn()},
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
  },
}));

describe('getEffectiveIsOnline', () => {
  beforeEach(() => {
    setNetInfoConnected(true);
    setServerReachable(true);
  });

  it('is online only when the link is up and the last ping reached the server', () => {
    expect(getEffectiveIsOnline()).toBe(true);
    setServerReachable(false);
    expect(getEffectiveIsOnline()).toBe(false);
    setServerReachable(true);
    setNetInfoConnected(false);
    expect(getEffectiveIsOnline()).toBe(false);
  });
});

describe('isCheckoutNetworkFailure', () => {
  it('queues on network and simulated-offline errors', () => {
    expect(
      isCheckoutNetworkFailure({
        isAxiosError: true,
        message: 'Network Error',
        code: 'ERR_NETWORK',
      }),
    ).toBe(true);
    expect(
      isCheckoutNetworkFailure({
        isAxiosError: true,
        code: 'SIMULATED_OFFLINE',
        message: 'Simulated offline',
      }),
    ).toBe(true);
  });

  it('does not queue a server validation error', () => {
    expect(
      isCheckoutNetworkFailure({
        isAxiosError: true,
        message: 'Request failed with status code 400',
        response: {status: 400, data: {error: 'Customer is required'}},
      }),
    ).toBe(false);
  });
});
