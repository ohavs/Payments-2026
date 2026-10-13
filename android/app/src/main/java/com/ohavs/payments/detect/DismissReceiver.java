package com.ohavs.payments.detect;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** "התעלם" on the notification: forget the suggestion without opening the app. */
public class DismissReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String id = intent.getStringExtra(DetectNotifier.EXTRA_ID);
        if (id == null) return;
        SuggestionStore.remove(context, id);
        DetectNotifier.cancel(context, id);
        PaymentDetectPlugin.notifyChanged();
    }
}
