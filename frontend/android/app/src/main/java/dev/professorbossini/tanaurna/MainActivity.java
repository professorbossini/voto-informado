package dev.professorbossini.tanaurna;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AparelhoPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
