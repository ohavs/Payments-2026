package com.ohavs.payments;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.ohavs.payments.detect.PaymentDetectPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ApkUpdaterPlugin.class);
        registerPlugin(PaymentDetectPlugin.class);
        registerPlugin(GmailTokenPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
