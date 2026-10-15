package com.ohavs.payments;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.ohavs.payments.detect.PaymentDetectPlugin;
import com.ohavs.payments.widget.WidgetBridgePlugin;

/**
 * The app. Launchers start it through an activity-alias, one per palette
 * icon (AndroidManifest.xml); ".MainActivity", the green one, keeps the name
 * of the activity that used to be here so existing home screen icons stay.
 */
public class AppActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ApkUpdaterPlugin.class);
        registerPlugin(PaymentDetectPlugin.class);
        registerPlugin(GmailTokenPlugin.class);
        registerPlugin(WidgetBridgePlugin.class);
        registerPlugin(AppIconPlugin.class);
        super.onCreate(savedInstanceState);
    }

    // A new icon is applied when the user leaves (home / recents), because
    // switching the alias closes the screen that was opened through it.
    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        AppIcons.applyPending(this);
    }

    @Override
    public void onStop() {
        super.onStop();
        if (isFinishing()) AppIcons.applyPending(this);
    }
}
