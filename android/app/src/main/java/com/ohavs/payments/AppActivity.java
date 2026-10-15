package com.ohavs.payments;

import android.content.Intent;
import android.content.IntentSender;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.ohavs.payments.detect.PaymentDetectPlugin;
import com.ohavs.payments.widget.WidgetBridgePlugin;

/**
 * The app. Launchers start it through an activity-alias (AndroidManifest.xml);
 * ".MainActivity", the green one, keeps the name of the activity that used to
 * be here so existing home screen icons stay.
 */
public class AppActivity extends BridgeActivity {
    // This screen opened another one (sign-in, share, installer, settings)
    // and the user is coming back to it.
    private boolean openedOther;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ApkUpdaterPlugin.class);
        registerPlugin(PaymentDetectPlugin.class);
        registerPlugin(GmailTokenPlugin.class);
        registerPlugin(WidgetBridgePlugin.class);
        super.onCreate(savedInstanceState);
        // Icons per palette were dropped: a phone that did switch goes back
        // to the green one, once the user leaves the app.
        AppIcons.request(this, "green");
    }

    @Override
    public void onResume() {
        super.onResume();
        openedOther = false;
    }

    // Every startActivity goes through here too.
    @Override
    @SuppressWarnings("deprecation")
    public void startActivityForResult(Intent intent, int requestCode, Bundle options) {
        openedOther = true;
        super.startActivityForResult(intent, requestCode, options);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void startIntentSenderForResult(IntentSender intent, int requestCode, Intent fillInIntent,
            int flagsMask, int flagsValues, int extraFlags, Bundle options) throws IntentSender.SendIntentException {
        openedOther = true;
        super.startIntentSenderForResult(intent, requestCode, fillInIntent, flagsMask, flagsValues, extraFlags, options);
    }

    // A new icon is applied once the app is out of sight (home, recents, a
    // swipe with gesture navigation, back), because switching the alias closes
    // the screen that was opened through it. Not while the user is in a screen
    // the app opened, since they come back to this one.
    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        AppIcons.applyPending(this);
    }

    @Override
    public void onStop() {
        super.onStop();
        if (isFinishing() || (!openedOther && !isChangingConfigurations())) AppIcons.applyPending(this);
    }
}
