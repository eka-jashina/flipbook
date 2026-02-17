package com.flipbook.reader;

import android.os.Bundle;

import com.flipbook.reader.plugins.BookImportPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BookImportPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
