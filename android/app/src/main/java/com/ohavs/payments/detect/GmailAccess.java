package com.ohavs.payments.detect;

import android.content.Context;

import com.google.android.gms.auth.GoogleAuthUtil;
import com.google.android.gms.auth.UserRecoverableAuthException;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.common.api.Scope;

/**
 * Gmail read access without any UI, once the user has granted it. Must run off
 * the main thread. reason is set when there is no token: no-account,
 * no-permission (never granted), consent (Google wants it confirmed again) or
 * error.
 */
public final class GmailAccess {
    public static final String SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

    public static final class Result {
        public String token;
        public String email;
        public String reason;
        public String message;
    }

    private GmailAccess() {}

    public static Result silentToken(Context ctx) {
        Result r = new Result();
        try {
            GoogleSignInAccount account = GoogleSignIn.getLastSignedInAccount(ctx);
            if (account == null || account.getAccount() == null) {
                r.reason = "no-account";
            } else if (!GoogleSignIn.hasPermissions(account, new Scope(SCOPE))) {
                r.reason = "no-permission";
            } else {
                r.token = GoogleAuthUtil.getToken(ctx, account.getAccount(), "oauth2:" + SCOPE);
                r.email = account.getEmail();
            }
        } catch (UserRecoverableAuthException e) {
            r.reason = "consent";
        } catch (Exception e) {
            r.reason = "error";
            r.message = String.valueOf(e.getMessage());
        }
        return r;
    }

    /** A token Gmail rejected (revoked or expired): drop it from the cache. */
    static void invalidate(Context ctx, String token) {
        try {
            GoogleAuthUtil.clearToken(ctx, token);
        } catch (Exception ignored) {
            // A fresh token is requested next time anyway.
        }
    }
}
