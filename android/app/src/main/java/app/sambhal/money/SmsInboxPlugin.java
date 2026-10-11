package app.sambhal.money;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.provider.Telephony;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Reads bank / UPI SMS from the phone's inbox so Sambhal can suggest payments and spends.
 *
 * Privacy: only messages that look like a completed money movement (an amount plus a
 * credit or debit word) are returned; everything else stays on the device unread by the
 * app. Nothing is sent anywhere: the web layer parses and stores only amounts and names.
 *
 * Reading the inbox needs READ_SMS, which only the Play Store build declares. Every
 * build also accepts "Share → Sambhal" from the SMS app (no permission needed): the
 * shared text is handed to the web layer as a "sharedText" event.
 */
@CapacitorPlugin(
    name = "SmsInbox",
    permissions = { @Permission(strings = { Manifest.permission.READ_SMS }, alias = SmsInboxPlugin.SMS) }
)
public class SmsInboxPlugin extends Plugin {

    static final String SMS = "sms";
    private static final int MAX_MESSAGES = 300;
    private static final Pattern AMOUNT = Pattern.compile("(rs\\.?|inr|₹)\\s*[0-9]");
    private static final Pattern MONEY_WORD = Pattern.compile(
        "\\b(credited|debited|received|deposited|sent|paid|spent|withdrawn|transferred)\\b"
    );

    private static SmsInboxPlugin instance;
    private static String pendingShare;

    @Override
    public void load() {
        instance = this;
        emitShare();
    }

    /** Called by MainActivity for launch and new intents; keeps shared text until JS is ready. */
    static void handleIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        String type = intent.getType();
        if (type == null || !type.startsWith("text/")) return;
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null || text.trim().isEmpty()) return;
        pendingShare = text;
        if (instance != null) instance.emitShare();
    }

    private void emitShare() {
        if (pendingShare == null) return;
        JSObject data = new JSObject();
        data.put("text", pendingShare);
        pendingShare = null;
        // Retained until the web layer adds its listener.
        notifyListeners("sharedText", data, true);
    }

    /** Whether this build can read the inbox (the Play build declares READ_SMS). */
    @PluginMethod
    public void capabilities(PluginCall call) {
        boolean declared = false;
        try {
            PackageInfo info = getContext()
                .getPackageManager()
                .getPackageInfo(getContext().getPackageName(), PackageManager.GET_PERMISSIONS);
            if (info.requestedPermissions != null) {
                for (String p : info.requestedPermissions) {
                    if (Manifest.permission.READ_SMS.equals(p)) declared = true;
                }
            }
        } catch (Exception e) {
            declared = false;
        }
        JSObject r = new JSObject();
        r.put("canRead", declared);
        call.resolve(r);
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        call.resolve(grantedResult());
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (getPermissionState(SMS) == PermissionState.GRANTED) {
            call.resolve(grantedResult());
        } else {
            requestPermissionForAlias(SMS, call, "permissionCallback");
        }
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        call.resolve(grantedResult());
    }

    /** Money SMS received after `since` (ms since epoch), newest first. */
    @PluginMethod
    public void readSince(PluginCall call) {
        if (getPermissionState(SMS) != PermissionState.GRANTED) {
            call.reject("SMS permission not granted", "PERMISSION_DENIED");
            return;
        }
        long since = call.getLong("since", 0L);
        int limit = Math.min(call.getInt("limit", MAX_MESSAGES), MAX_MESSAGES);
        String[] projection = { Telephony.Sms._ID, Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE };
        JSArray messages = new JSArray();
        Cursor cursor = null;
        try {
            cursor = getContext()
                .getContentResolver()
                .query(
                    Telephony.Sms.Inbox.CONTENT_URI,
                    projection,
                    Telephony.Sms.DATE + " > ?",
                    new String[] { String.valueOf(since) },
                    Telephony.Sms.DATE + " DESC"
                );
            if (cursor != null) {
                int count = 0;
                while (cursor.moveToNext() && count < limit) {
                    String body = cursor.getString(2);
                    if (body == null || !looksLikeMoney(body)) continue;
                    JSObject m = new JSObject();
                    m.put("id", cursor.getString(0));
                    m.put("address", cursor.getString(1));
                    m.put("body", body);
                    m.put("date", cursor.getLong(3));
                    messages.put(m);
                    count++;
                }
            }
        } catch (Exception e) {
            call.reject("Could not read SMS", "READ_FAILED", e);
            return;
        } finally {
            if (cursor != null) cursor.close();
        }
        JSObject result = new JSObject();
        result.put("messages", messages);
        call.resolve(result);
    }

    private JSObject grantedResult() {
        JSObject r = new JSObject();
        r.put("granted", getPermissionState(SMS) == PermissionState.GRANTED);
        return r;
    }

    static boolean looksLikeMoney(String body) {
        String s = body.toLowerCase(Locale.ROOT);
        return AMOUNT.matcher(s).find() && MONEY_WORD.matcher(s).find();
    }
}
