import type {BranchSessionState} from '../context/Store';

/** Parity with web `BranchSelectModal` visibility checks. */
export function shouldShowBranchSelectModal(
  branchSession: BranchSessionState | undefined,
  authenticated: boolean,
): boolean {
  if (!authenticated || !branchSession) {
    return false;
  }
  return (
    branchSession.branchSelectionPending === true &&
    branchSession.enable_multiple_branches === true &&
    branchSession.can_switch_branch !== false
  );
}
