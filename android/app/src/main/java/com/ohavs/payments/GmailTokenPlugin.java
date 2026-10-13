package com.ohavs.payments;

import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.GoogleAuthUtil;
import com.google.android.gms.auth.UserRecoverableAuthException;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.common.api.Scope;

/**
 * Gmail read access without any UI, once the user has granted it: lets the
 * app scan receipts in the background on launch. Returns no token (and a
 * reason) when the grant is missing or has to be confirmed again, so the app
 * falls back to the interactive flow.
 */
@CapacitorPlugin(name = "GmailToken")
public class GmailTokenPlugin extends Plugin {
    private static final String SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

    @PluginMethod
    public void silentToken(PluginCall call) {
        getBridge().execute(() -> {
            JSObject ret = new JSObject();
            try {
                Context ctx = getContext();
                GoogleSignInAccount account = GoogleSignIn.getLastSignedInAccount(ctx);
                if (account == null || account.getAccount() == null) {
                    ret.put("reason", "no-account");
                } else if (!GoogleSignIn.hasPermissions(account, new Scope(SCOPE))) {
                    ret.put("reason", "no-permission");
                } else {
                    ret.put("token", GoogleAuthUtil.getToken(ctx, account.getAccount(), "oauth2:" + SCOPE));
                    ret.put("email", account.getEmail());
                }
            } catch (UserRecoverableAuthException e) {
                ret.put("reason", "consent");
            } catch (Exception e) {
                ret.put("reason", "error");
                ret.put("message", String.valueOf(e.getMessage()));
            }
            call.resolve(ret);
        });
    }
}
