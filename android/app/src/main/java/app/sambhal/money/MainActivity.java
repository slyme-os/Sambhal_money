package app.sambhal.money;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Local plugins must be registered before the bridge starts.
        registerPlugin(SmsInboxPlugin.class);
        super.onCreate(savedInstanceState);
        SmsInboxPlugin.handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        // "Share → Sambhal" while the app is already open.
        SmsInboxPlugin.handleIntent(intent);
    }
}
