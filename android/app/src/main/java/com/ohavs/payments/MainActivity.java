package com.ohavs.payments;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.ohavs.payments.detect.PaymentDetectPlugin;
import com.ohavs.payments.widget.WidgetBridgePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ApkUpdaterPlugin.class);
        registerPlugin(PaymentDetectPlugin.class);
        registerPlugin(GmailTokenPlugin.class);
        registerPlugin(WidgetBridgePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
