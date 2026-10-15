package com.ohavs.payments;

import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;

/**
 * The launcher icon: one activity-alias per palette, exactly one enabled.
 * Icons per palette were dropped (the switch didn't take on every phone);
 * the aliases stay so a phone that did switch can go back to green. The app
 * asks for it (pending) and it is switched when the user leaves the app
 * (AppActivity), since the system closes activities opened through the alias
 * that gets disabled.
 */
public final class AppIcons {
    static final String[] NAMES = {"green", "violet", "coral", "ocean", "honey"};
    private static final String PREFS = "app_icon";

    private AppIcons() {}

    static boolean valid(String name) {
        for (String n : NAMES) if (n.equals(name)) return true;
        return false;
    }

    private static ComponentName alias(Context c, String name) {
        String cls = "green".equals(name) ? "MainActivity" : "Icon" + Character.toUpperCase(name.charAt(0)) + name.substring(1);
        return new ComponentName(c.getPackageName(), "com.ohavs.payments." + cls);
    }

    private static boolean enabledByDefault(String name) {
        return "green".equals(name);
    }

    /** The icon the launcher shows now. */
    static String current(Context c) {
        PackageManager pm = c.getPackageManager();
        for (String n : NAMES) {
            int state = pm.getComponentEnabledSetting(alias(c, n));
            boolean on = state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                || (state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT && enabledByDefault(n));
            if (on) return n;
        }
        return "green";
    }

    static String pending(Context c) {
        return prefs(c).getString("pending", "");
    }

    static void request(Context c, String name) {
        if (name.equals(current(c))) prefs(c).edit().remove("pending").apply();
        else prefs(c).edit().putString("pending", name).apply();
    }

    /** Switches to the requested icon, if any: the new alias first, so there is always one. */
    static void applyPending(Context c) {
        String want = pending(c);
        if (!valid(want)) return;
        prefs(c).edit().remove("pending").apply();
        if (want.equals(current(c))) return;
        PackageManager pm = c.getPackageManager();
        try {
            pm.setComponentEnabledSetting(alias(c, want), enabledByDefault(want)
                ? PackageManager.COMPONENT_ENABLED_STATE_DEFAULT : PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                PackageManager.DONT_KILL_APP);
            for (String n : NAMES) {
                if (n.equals(want)) continue;
                pm.setComponentEnabledSetting(alias(c, n), enabledByDefault(n)
                    ? PackageManager.COMPONENT_ENABLED_STATE_DISABLED : PackageManager.COMPONENT_ENABLED_STATE_DEFAULT,
                    PackageManager.DONT_KILL_APP);
            }
        } catch (RuntimeException e) {
            android.util.Log.w("AppIcons", "icon switch failed", e);
        }
    }

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
