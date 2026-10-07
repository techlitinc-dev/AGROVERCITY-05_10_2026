import { registerLocale } from '../index';

/**
 * FPO (discovery, join, pools, shared machinery) strings — merged into `en`.
 * Key catalog is the contract for every view under views/fpo/.
 */

const enFpo: Record<string, string> = {
  fpoDirectoryTitle: 'FPO directory',
  fpoDirectoryHint: 'Join a farmer producer organisation near you.',
  fpoMemberCount: '{count} members',
  fpoMembershipMember: 'Member',
  fpoMembershipPending: 'Request pending',
  fpoMembershipNone: 'Not a member',
  fpoVerificationUnverified: 'Verification pending',
  fpoVerificationVerified: 'Verified',
  fpoJoin: 'Request to join',
  fpoJoinSent: 'Join request sent — awaiting approval.',
  fpoJoinApproveDev: 'Mark as member (dev)',
  fpoJoinAlreadyMember: 'You are already a member.',
  fpoEmpty: 'No FPO found.',
  fpoLoadFailed: 'Could not load the FPO directory.',

  fpoPoolsTitle: 'Group-buy pools',
  fpoPoolsHint: 'Pool demand with other members for a group discount.',
  fpoPoolsEmpty: 'No open group-buy pools.',
  fpoPoolsLoadFailed: 'Could not load the group-buy pools.',
  fpoPoolProgress: '{booked} / {target} units',
  fpoPoolDiscount: '{percent}% group discount',
  fpoPoolDeadline: 'Closes {date}',
  fpoPoolJoin: 'Join pool',
  fpoPoolJoined: 'You joined the pool.',
  fpoPoolFull: 'This pool has reached its target.',
  fpoPoolUnits: 'Units',

  fpoMachineryTitle: 'Shared machinery calendar',
  fpoMachineryHint: 'Machinery and slots shared through the FPO.',
  fpoMachineryEmpty: 'No shared machinery slots this week.',
  fpoMachineryLoadFailed: 'Could not load the machinery calendar.',
  fpoMachineryWeek: 'Week starting {date}',
  fpoSlotAvailable: 'Available',
  fpoSlotBooked: 'Booked',
  fpoSlotPrice: '₹{price}',
};

registerLocale('en', enFpo);
