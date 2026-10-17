import type { MockInstance } from 'vitest';

import type {
  GoCardlessAgreementId,
  GoCardlessInstitutionId,
} from '#app-gocardless/gocardless-node.types';
import { GoCardlessApi } from '#app-gocardless/services/gocardless-api';

import { mockCreateRequisition } from './fixtures';

const ingInstitutionId = 'ING_INGBITMM' as GoCardlessInstitutionId;
const otherInstitutionId = 'BBVA_BBVAESMM' as GoCardlessInstitutionId;

describe('GoCardlessApi#initSession', () => {
  let client: GoCardlessApi;
  let createAgreementSpy: MockInstance;
  let createRequisitionSpy: MockInstance;

  beforeEach(() => {
    client = new GoCardlessApi({
      secretId: 'secret-id',
      secretKey: 'secret-key',
    });
    createAgreementSpy = vi.spyOn(client, 'createAgreement');
    createRequisitionSpy = vi.spyOn(client, 'createRequisition');

    createAgreementSpy.mockImplementation(
      async ({ institutionId, maxHistoricalDays, accessValidForDays }) => ({
        id: `agreement-for-${institutionId}` as GoCardlessAgreementId,
        created: '2026-10-17T00:00:00.000Z',
        max_historical_days: maxHistoricalDays ?? 90,
        access_valid_for_days: accessValidForDays ?? 90,
        access_scope: ['balances', 'details', 'transactions'],
        accepted: null,
        institution_id: institutionId,
      }),
    );
    createRequisitionSpy.mockResolvedValue(mockCreateRequisition);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('pre-creates an end-user agreement for regular institutions', async () => {
    await client.initSession({
      redirectUrl: 'https://example.com/gocardless/link',
      institutionId: otherInstitutionId,
      maxHistoricalDays: 730,
      accessValidForDays: 180,
    });

    expect(createAgreementSpy).toHaveBeenCalledTimes(1);
    expect(createAgreementSpy).toHaveBeenCalledWith({
      institutionId: otherInstitutionId,
      maxHistoricalDays: 730,
      accessValidForDays: 180,
    });
    expect(createRequisitionSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        institutionId: otherInstitutionId,
        agreement: `agreement-for-${otherInstitutionId}`,
      }),
    );
  });

  it('skips the pre-created agreement for ING_INGBITMM so the requisition does not get stuck in UA', async () => {
    // Regression test for https://github.com/actualbudget/actual/issues/8902:
    // ING_INGBITMM cannot finalize a requisition bound to a pre-created
    // agreement, so we must not create one and let GoCardless create its
    // default agreement inline with the requisition instead.
    await client.initSession({
      redirectUrl: 'https://example.com/gocardless/link',
      institutionId: ingInstitutionId,
      maxHistoricalDays: 730,
      accessValidForDays: 180,
    });

    expect(createAgreementSpy).not.toHaveBeenCalled();
    expect(createRequisitionSpy).toHaveBeenCalledTimes(1);
    expect(createRequisitionSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        institutionId: ingInstitutionId,
        agreement: undefined,
      }),
    );
  });
});
