import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL_ID = 'waypoint-nudges';
const OWNED_IDENTIFIER_PREFIX = 'waypoint:';

export type NotificationSource = 'onboarding' | 'settings';
export type NotificationSyncReason = 'app-startup' | 'onboarding-accepted';

export type NotificationPermission = 'undetermined' | 'granted' | 'denied' | 'provisional';

export type NotificationAccess = {
  permission: NotificationPermission;
  canAskAgain: boolean;
  changed: boolean;
};

export type NotificationFailureCode =
  | 'native-unavailable'
  | 'native-permission-failed'
  | 'native-schedule-failed';

export type NotificationFailure = {
  code: NotificationFailureCode;
  message: string;
  recoverable: boolean;
};

export type NotificationSyncResult = {
  permission: NotificationPermission;
  scheduled: number;
  cancelled: number;
  skippedReason?: 'not-authenticated' | 'permission-not-granted' | 'no-triggers';
  warnings: NotificationFailure[];
};

export interface WaypointNotifications {
  requestAccess(input: { userId: string; source: NotificationSource }): Promise<NotificationAccess>;

  sync(input: {
    userId: string | null;
    reason: NotificationSyncReason;
    now?: Date;
  }): Promise<NotificationSyncResult>;
}

type CampaignKey =
  | 'bank-holiday-nudge'
  | 'monday-recovery-joke'
  | 'midweek-weekend-plan'
  | 'evening-wellbeing-check';

type CampaignSchedule = {
  key: CampaignKey;
  title: string;
  body: string;
  trigger: Notifications.NotificationTriggerInput;
};

const ENGLAND_WALES_BANK_HOLIDAYS = [
  '2026-01-01',
  '2026-04-03',
  '2026-04-06',
  '2026-05-04',
  '2026-05-25',
  '2026-08-31',
  '2026-12-25',
  '2026-12-28',
  '2027-01-01',
  '2027-03-26',
  '2027-03-29',
  '2027-05-03',
  '2027-05-31',
  '2027-08-30',
  '2027-12-27',
  '2027-12-28',
] as const;

let notificationHandlerConfigured = false;

function configureForegroundHandling() {
  if (notificationHandlerConfigured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  notificationHandlerConfigured = true;
}

function mapPermission(
  status: Notifications.NotificationPermissionsStatus
): NotificationPermission {
  if (status.granted) return 'granted';
  if (status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return 'provisional';
  }
  if (status.status === 'denied') return 'denied';
  return 'undetermined';
}

async function readPermission(): Promise<Notifications.NotificationPermissionsStatus> {
  try {
    return await Notifications.getPermissionsAsync();
  } catch (err) {
    throw failure(
      'native-permission-failed',
      err instanceof Error ? err.message : 'Unable to read notification permission.'
    );
  }
}

function failure(code: NotificationFailureCode, message: string): NotificationFailure {
  return {
    code,
    message,
    recoverable: code !== 'native-unavailable',
  };
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Waypoint nudges',
    description: 'Social reminders, weekend plan nudges, and wellbeing checks.',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 180, 120, 180],
    lightColor: '#007AFF',
  });
}

function weeklyTrigger(
  weekday: number,
  hour: number,
  minute: number
): Notifications.NotificationTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    weekday,
    hour,
    minute,
    channelId: CHANNEL_ID,
  };
}

function nextBankHolidayNudge(now: Date): Date | null {
  for (const isoDate of ENGLAND_WALES_BANK_HOLIDAYS) {
    const [year, month, day] = isoDate.split('-').map(Number);
    const nudgeAt = new Date(year, month - 1, day - 1, 18, 0, 0, 0);
    if (nudgeAt > now) return nudgeAt;
  }
  return null;
}

function campaignSchedule(now: Date): CampaignSchedule[] {
  const bankHoliday = nextBankHolidayNudge(now);
  const schedules: CampaignSchedule[] = [
    {
      key: 'monday-recovery-joke',
      title: 'Recovered from the weekend yet?',
      body: 'Ease into Monday by lining up one low-pressure plan this week.',
      trigger: weeklyTrigger(2, 10, 15),
    },
    {
      key: 'midweek-weekend-plan',
      title: 'Weekend plans still wide open?',
      body: 'A quick nudge to join something before the good plans fill up.',
      trigger: weeklyTrigger(4, 18, 30),
    },
    {
      key: 'evening-wellbeing-check',
      title: 'Small check-in',
      body: 'How is your week feeling? A walk, coffee, or tiny plan counts.',
      trigger: weeklyTrigger(1, 19, 30),
    },
  ];

  if (bankHoliday) {
    schedules.unshift({
      key: 'bank-holiday-nudge',
      title: 'Long weekend incoming',
      body: 'Bank holiday energy is better with a plan. See what is nearby.',
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: bankHoliday,
        channelId: CHANNEL_ID,
      },
    });
  }

  return schedules;
}

async function cancelOwnedNotifications(): Promise<number> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const owned = scheduled.filter((item) => item.identifier.startsWith(OWNED_IDENTIFIER_PREFIX));

  await Promise.all(
    owned.map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier))
  );

  return owned.length;
}

async function scheduleCampaigns(
  schedules: CampaignSchedule[]
): Promise<{ scheduled: number; warnings: NotificationFailure[] }> {
  let scheduled = 0;
  const warnings: NotificationFailure[] = [];

  for (const schedule of schedules) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `${OWNED_IDENTIFIER_PREFIX}${schedule.key}`,
        content: {
          title: schedule.title,
          body: schedule.body,
          sound: false,
          data: {
            campaignKey: schedule.key,
            ownedBy: 'waypoint',
          },
        },
        trigger: schedule.trigger,
      });
      scheduled += 1;
    } catch (err) {
      warnings.push(
        failure(
          'native-schedule-failed',
          err instanceof Error ? err.message : `Unable to schedule ${schedule.key}.`
        )
      );
    }
  }

  return { scheduled, warnings };
}

class ExpoWaypointNotifications implements WaypointNotifications {
  async requestAccess({
    userId,
  }: {
    userId: string;
    source: NotificationSource;
  }): Promise<NotificationAccess> {
    if (!userId) {
      return {
        permission: 'undetermined',
        canAskAgain: false,
        changed: false,
      };
    }

    const before = mapPermission(await readPermission());
    const requested = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    const permission = mapPermission(requested);

    return {
      permission,
      canAskAgain: requested.canAskAgain,
      changed: permission !== before,
    };
  }

  async sync({
    userId,
    now = new Date(),
  }: {
    userId: string | null;
    reason: NotificationSyncReason;
    now?: Date;
  }): Promise<NotificationSyncResult> {
    if (!userId) {
      return {
        permission: 'undetermined',
        scheduled: 0,
        cancelled: 0,
        skippedReason: 'not-authenticated',
        warnings: [],
      };
    }

    configureForegroundHandling();

    const permission = mapPermission(await readPermission());
    if (permission !== 'granted' && permission !== 'provisional') {
      const cancelled = await cancelOwnedNotifications();
      return {
        permission,
        scheduled: 0,
        cancelled,
        skippedReason: 'permission-not-granted',
        warnings: [],
      };
    }

    const schedules = campaignSchedule(now);
    if (schedules.length === 0) {
      const cancelled = await cancelOwnedNotifications();
      return {
        permission,
        scheduled: 0,
        cancelled,
        skippedReason: 'no-triggers',
        warnings: [],
      };
    }

    await ensureChannel();
    const cancelled = await cancelOwnedNotifications();
    const { scheduled, warnings } = await scheduleCampaigns(schedules);

    return {
      permission,
      scheduled,
      cancelled,
      warnings,
    };
  }
}

export const waypointNotifications: WaypointNotifications = new ExpoWaypointNotifications();
