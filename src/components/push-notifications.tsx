"use client";

import * as React from "react";
import { Bell, BellOff, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getPushSupportState,
  getServiceWorkerRegistration,
  sendTestPushNotification,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  type PushSupportState,
} from "@/lib/push-client";
import { cn } from "@/lib/utils";

type PushUiState = PushSupportState | "loading";

export function PushNotifications({ className }: { className?: string }) {
  const [state, setState] = React.useState<PushUiState>("loading");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    const permission =
      typeof window !== "undefined" && "Notification" in window
        ? Notification.permission
        : null;
    const support = getPushSupportState(permission);
    if (support !== "ready") {
      setState(support);
      return;
    }

    const registration = await getServiceWorkerRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    setState(subscription ? "subscribed" : "ready");
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleEnable() {
    setBusy(true);
    setMessage(null);
    try {
      await subscribeToPushNotifications();
      setState("subscribed");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "enable_failed";
      if (detail === "notification_permission_denied") {
        setState("denied");
        setMessage("Notifications blocked in system settings.");
      } else if (detail.startsWith("vapid_unavailable")) {
        setMessage("Push is not configured on the server yet.");
      } else {
        setMessage("Could not enable notifications.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    setMessage(null);
    try {
      await unsubscribeFromPushNotifications();
      setState("ready");
    } catch {
      setMessage("Could not disable notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    setBusy(true);
    setMessage(null);
    try {
      await sendTestPushNotification();
      setMessage("Test notification sent.");
    } catch {
      setMessage("Test notification failed.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading" || state === "unsupported") {
    return null;
  }

  return (
    <div
      className={cn(
        "border-b bg-muted/30 px-4 py-3",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <Bell className="size-3.5" />
            Push alerts
          </p>

          {state === "needs-home-screen" ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Add Hermes to your Home Screen, then return here to enable native
              notifications on iOS.
            </p>
          ) : state === "denied" ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Notifications are blocked. Allow Hermes in system notification
              settings.
            </p>
          ) : state === "subscribed" ? (
            <p className="text-xs text-muted-foreground">
              You&apos;ll get native alerts when Hermes has updates.
            </p>
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Get native alerts when async Hermes jobs complete or the backend
              sends a webhook.
            </p>
          )}
        </div>

        {state === "needs-home-screen" ? (
          <Smartphone className="size-4 shrink-0 text-muted-foreground" />
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {state === "ready" ? (
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => void handleEnable()}
          >
            Enable notifications
          </Button>
        ) : null}

        {state === "subscribed" ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void handleTest()}
            >
              Send test
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void handleDisable()}
            >
              <BellOff className="size-3.5" />
              Disable
            </Button>
          </>
        ) : null}
      </div>

      {message ? (
        <p className="mt-2 text-xs text-muted-foreground">{message}</p>
      ) : null}
    </div>
  );
}
