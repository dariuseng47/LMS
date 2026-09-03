package com.seuic.uhftool.activity;

import android.content.Intent;
import android.os.Bundle;
import android.support.v4.app.FragmentActivity;

public class SelectActivity extends FragmentActivity {
    private static final String TAG = "SelectActivity";
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        startActivity(new Intent(SelectActivity.this, MainActivity.class));
        finish();
    }
}