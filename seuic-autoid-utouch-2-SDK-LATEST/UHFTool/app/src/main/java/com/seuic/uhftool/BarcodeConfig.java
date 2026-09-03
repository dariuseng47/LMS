package com.seuic.uhftool;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.SharedPreferences;

import com.seuic.uhf.EPC;
import com.seuic.uhf.UHFService;
import com.seuic.uhftool.util.DisplayUtil;
import com.seuic.uhftool.util.LogUtil;

public class BarcodeConfig {

    private static final String TAG = "BarcodeConfig";
    public static final String DEFAULT_MODEL = "DEFAULT_MODEL";
    public static final String MODEL_SESSION = "SESSION";
    public static final String MODEL_PROFILE = "PROFILE";
    public static final String MODEL_POWER = "POWER";
    public static final String MODEL_TARGET = "TARGET";

    public static final String MODEL_SESSION_GEN2X = "SESSION_GEN2X";
    public static final String MODEL_PROFILE_GEN2X = "PROFILE_GEN2X";
    public static final String MODEL_POWER_GEN2X = "POWER_GEN2X";
    public static final String MODEL_TARGET_GEN2X = "TARGET_GEN2X";
    /**
     *
     */
    public String TEMP;

    /**
     *
     */
    public int power;

    static BarcodeConfig mBarcodeConfig;

    UHFService mService;

    SharedPreferences mPreferences;
    SharedPreferences.Editor editor;

    Context mContext;

    private static final String BARCODE_NAME = "barcodesetting";

    public static BarcodeConfig getInstance(Context context) {
        if (mBarcodeConfig == null) {
            mBarcodeConfig = new BarcodeConfig(context);
        }

        return mBarcodeConfig;
    }

    @SuppressLint("CommitPrefEdits")
    private BarcodeConfig(Context context) {
        mService = UHFService.getInstance();
        mContext = context;
        mPreferences = mContext.getSharedPreferences(BARCODE_NAME, Context.MODE_PRIVATE);
        editor = mPreferences.edit();
    }

    public void setValue(String key, int value) {
        editor.putInt(key, value);
        editor.commit();
    }

    public void setDefaultValues() {
        if (mPreferences.getBoolean("first_time", true)) {
            editor.putBoolean("first_time", false);
            mService.setParameters(UHFService.PARAMETER_INVENTORY_SPEED, 1);
            if (DisplayUtil.getUhfPad().equals("M100") || DisplayUtil.getModel().equals("D621")) {
                editor.putInt("power", 25);
                editor.putInt("PARAMETER_INVENTORY_SESSION", 0);
            } else {
                if (DisplayUtil.getUhfPad().equals("E710-US") || DisplayUtil.getUhfPad().contains("E510") || DisplayUtil.getUhfPad().equals("TM600-C")) {
                    editor.putInt("power", 30);
                    editor.putInt(MODEL_POWER, 29);
                }else {
                    editor.putInt("power", 33);
                    editor.putInt(MODEL_POWER, 32);
                }
                editor.putInt("PARAMETER_INVENTORY_SESSION", 1);
            }
            editor.putInt("PARAMETER_LINK_PROFILE", 1);
            editor.putInt("PARAMETER_INVENTORY_SESSION_TARGET", 0);
            editor.putInt("PARAMETER_INVENTORY_SPEED", 1);
            editor.putInt("PARAMETER_CLEAR_EPCLIST_WHEN_START_INVENTORY", 1);
            editor.putInt("PARAMETER_HIDE_PC", 1);
            editor.putInt("PARAMETER_ALGORITHM_STARTQVALUE", 1);
            editor.putInt("PARAMETER_ALGORITHM_MINQVALUE", 0);
            editor.putInt("PARAMETER_ALGORITHM_MAXQVALUE", 12);
            editor.putInt("PARAMETER_ALGORITHM_RETRYCOUNT", 0);
            editor.putInt("PARAMETER_ALGORITHM_TOGGLETARGET", 0);
            editor.putInt("PARAMETER_ALGORITHM_THRESHOLDMULTIPLIER", 0);
            editor.putInt("PARAMETER_EXTENSIONS_FASTID", 0);
            editor.putInt("PARAMETER_EXTENSIONS_TAGFOCUS", 0);
            editor.putInt("PARAMETER_S2_ALGORITHM", 0);
            editor.putInt(DEFAULT_MODEL, -1);
            editor.putInt(MODEL_SESSION, 2);
            editor.putInt(MODEL_PROFILE, 1);
            editor.putInt(MODEL_TARGET, 0);
            editor.commit();
        }
    }

    public int getValue(String key, int defaultValue) {
        int res = defaultValue;
        res = mPreferences.getInt(key, defaultValue);
        return res;
    }

    public boolean setPower(int value) {
        boolean result = false;
        try {
            result = mService.setPower(value);
            power = value;
            LogUtil.i(TAG, "setPower result " + result);
            setValue("power", value);
        } catch (Exception e) {
            e.printStackTrace();
        }
        return result;
    }

    public boolean setParameters(int key, int value) {

        boolean result = false;
        try {
            result = mService.setParameters(key, value);
            LogUtil.i(TAG, "Set Parameters result: " + result + "\tkey: " + key + "\tvalue: " + value);
        } catch (Exception e) {
            e.printStackTrace();
        }
        return result;
    }

    EPC epc;
}
