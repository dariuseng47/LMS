package com.seuic.uhftool;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.SharedPreferences.Editor;

import com.seuic.uhftool.iml.IAppconfig;
import com.seuic.uhftool.util.DisplayUtil;
import com.seuic.uhftool.util.LogUtil;

public class Appconfig implements IAppconfig {

    public static final boolean DEBUG = true;

    private static final String TAG = "Appconfig";

    private static Appconfig mAppconfig;

    private static Context mContext;

    public SharedPreferences mPreferences;

    public static Appconfig getInstance(Context context) {
        if (mAppconfig == null) {
            synchronized (Appconfig.class) {
                if (mAppconfig == null) {
                    mAppconfig = new Appconfig(context);
                }
            }
        }

        return mAppconfig;
    }

    private Appconfig(Context context) {
        mContext = context;
        mPreferences = mContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
        if (mPreferences.getInt(SENDMODE, -1) == -1) {
            initDefValue();
        } else {
            load();
        }
    }

    public boolean bootStart = false;
    public boolean DEF_bootStart = false;

    public boolean playSound = true;
    public boolean DEF_palySound = true;

    public boolean vibrate = false;
    public boolean DEF_vibrate = false;

    public boolean continueSeek = true;
    public boolean DEF_continueSeek = true;
    public boolean continueTime = false;

    public boolean goStop = true;
    public boolean DEF_goStop = true;

    public boolean isSpecial = false;
    public boolean isFilter = false;
    public int filterBank = 1;
    public int filterAddress = 0;
    public int filterLenth = 0;
    public int filterMatch = 0;
    public String filterString = "";

    public String region = "FCC";

    public boolean isEmbeded = false;
    public int embededBank = 2;
    public int embededAddress = 0;
    public int embededLenth = 0;
    public String embededPwd = "00000000";

    public int soundRepeat = 1;
    public int export = 0;
    public int tidSort = 0;
    public int moduleType = 0;

    public String prefix = "";

    public String suffix = "";

    public int endchar = DEF_ENDCHAR;

    public int intervalChar = DEF_INTERVAL_CHAR;

    public int sendmode = DEF_SENDMODE;

    public String scanKey = DEF_SCAN_KEY;

    public boolean endcharOnEmu = false;
    public boolean DEF_endcharOnEmu = false;

    public int partOfCard = EPC;

    public int dataStart = 0;

    public int dataLen = 0;

    public String devBroadcast = DEF_BROADCAST;

    public String devDatakey = DEF_KEY;

    public String devStart = DEF_START;

    public String devStop = DEF_STOP;

    public boolean dev_add_enter = DEF_ADD_ENTER;

    public boolean factory_test_33inv = false;
    public boolean factory_test_33w = false;
    public boolean factory_test_30w = false;
    public boolean factory_test_27w = false;

    @Override
    public void initDefValue() {
        Editor editor = mPreferences.edit();
        editor.putBoolean(BOOTSTART, bootStart);
        editor.putBoolean(PLAYSOUND, playSound);
        editor.putBoolean(VIBRATE, vibrate);
        editor.putBoolean(CONTINUE_SEEK, continueSeek);
        editor.putBoolean(CONTINUE_TIME, continueTime);
        editor.putBoolean(GO_STOP, goStop);
        editor.putBoolean(ENDCHAR_ON_EMU, endcharOnEmu);
        editor.putInt("filterBank", 1);
        editor.putInt("filterAddress", 0);
        editor.putInt("filterLenth", 0);
        editor.putInt("filterMatch", 0);
        editor.putString("filterString", "");
        editor.putBoolean("isEmbeded", false);
        editor.putInt("embededBank", 2);
        editor.putInt("embededAddress", 0);
        editor.putInt("embededLenth", 0);
        editor.putString("embededPwd", "00000000");
        editor.putString(PREFIX, prefix);
        editor.putString(SUFFIX, suffix);
        editor.putInt(ENDCHAR, endchar);
        editor.putInt(INTERVAL_CHAR, intervalChar);
        editor.putInt(SENDMODE, sendmode);
        editor.putString(SCAN_KEY, scanKey);
        editor.putInt(PART_OF_CARD, partOfCard);
        editor.putInt(DATA_START, dataStart);
        editor.putInt(DATA_LEN, dataLen);
        editor.putBoolean("inventory", false);
        editor.putBoolean(FACTORY_TEST_33INV, false);
        editor.putBoolean(FACTORY_TEST_33W, false);
        editor.putBoolean(FACTORY_TEST_30W, false);
        editor.putBoolean(FACTORY_TEST_27W, false);
        editor.putInt("soundRepeat", 1);
        editor.putInt("export", 0);
        editor.putInt("tidSort", 0);
        editor.putInt("moduleType", 0);
        if(DisplayUtil.getUhfPad().equals("M100")||DisplayUtil.getModel().equals("D621")){
            editor.putString("region", "China1");
        }else {
            editor.putString("region", "FCC");
        }

        editor.apply();
        initDefDeveloper();
    }

    @Override
    public void load() {
        if (mPreferences == null) {
            mPreferences = mContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
        }
        bootStart = mPreferences.getBoolean(BOOTSTART, false);
        playSound = mPreferences.getBoolean(PLAYSOUND, true);
        vibrate = mPreferences.getBoolean(VIBRATE, false);
        continueSeek = mPreferences.getBoolean(CONTINUE_SEEK, true);
        continueTime = mPreferences.getBoolean(CONTINUE_TIME, false);
        goStop = mPreferences.getBoolean(GO_STOP, true);
        filterBank = mPreferences.getInt("filterBank", 1);
        filterAddress = mPreferences.getInt("filterAddress", 0);
        filterLenth = mPreferences.getInt("filterLenth", 0);
        filterMatch = mPreferences.getInt("filterMatch", 0);
        filterString = mPreferences.getString("filterString", "");
        isEmbeded = mPreferences.getBoolean("isEmbeded", false);
        embededBank = mPreferences.getInt("embededBank", 2);
        embededAddress = mPreferences.getInt("embededAddress", 0);
        embededLenth = mPreferences.getInt("embededLenth", 0);
        embededPwd = mPreferences.getString("embededPwd", "00000000");
        prefix = mPreferences.getString(PREFIX, "");
        suffix = mPreferences.getString(SUFFIX, "");
        endchar = mPreferences.getInt(ENDCHAR, DEF_ENDCHAR);
        intervalChar = mPreferences.getInt(INTERVAL_CHAR, DEF_INTERVAL_CHAR);
        sendmode = mPreferences.getInt(SENDMODE, DEF_SENDMODE);
        scanKey = mPreferences.getString(SCAN_KEY, DEF_SCAN_KEY);
        endcharOnEmu = mPreferences.getBoolean(ENDCHAR_ON_EMU, false);
        partOfCard = mPreferences.getInt(PART_OF_CARD, EPC);
        dataStart = mPreferences.getInt(DATA_START, 0);
        dataLen = mPreferences.getInt(DATA_LEN, 0);
        devBroadcast = mPreferences.getString(DEV_BROADCAST, DEF_BROADCAST);
        devDatakey = mPreferences.getString(DEV_DATAKEY, DEF_KEY);
        devStart = mPreferences.getString(DEV_START, DEF_START);
        devStop = mPreferences.getString(DEV_STOP, DEF_STOP);
        dev_add_enter = mPreferences.getBoolean(DEV_ADD_ENTER, true);
        factory_test_33inv = mPreferences.getBoolean(FACTORY_TEST_33INV, false);
        factory_test_33w = mPreferences.getBoolean(FACTORY_TEST_33W, false);
        factory_test_30w = mPreferences.getBoolean(FACTORY_TEST_30W, false);
        factory_test_27w = mPreferences.getBoolean(FACTORY_TEST_27W, false);
        soundRepeat = mPreferences.getInt("soundRepeat", 1);
        export = mPreferences.getInt("export", 0);
        tidSort = mPreferences.getInt("tidSort", 0);
        moduleType = mPreferences.getInt("moduleType", 0);
        region = mPreferences.getString("region", "FCC");
    }

    @Override
    public void set(String key, Object value) {
        if (mPreferences == null) {
            mPreferences = mContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_WORLD_WRITEABLE);
        }
        Editor editor = mPreferences.edit();
        String changeValue = String.valueOf(value);
        try {
            if (isBooleanStyle(key)) {
                editor.putBoolean(key, Boolean.parseBoolean(changeValue));
            }
            if (isStringStyle(key)) {
                editor.putString(key, changeValue);
            }
            if (isIntStyle(key)) {
                editor.putInt(key, Integer.parseInt(changeValue));
            }
        } catch (Exception e) {
            e.printStackTrace();
            LogUtil.e(TAG, "preferences set error");
        }
        editor.apply();
        load();
    }

    private boolean isBooleanStyle(String key) {
        return PLAYSOUND.equals(key)
                || VIBRATE.equals(key)
                || BOOTSTART.equals(key)
                || GO_STOP.equals(key)
                || ENDCHAR_ON_EMU.equals(key)
                || CONTINUE_SEEK.equals(key)
                || CONTINUE_TIME.equals(key)
                || "isEmbeded".equals(key)
                || DEV_ADD_ENTER.equals(key)
                || FACTORY_TEST_33INV.equals(key)
                || FACTORY_TEST_33W.equals(key)
                || FACTORY_TEST_30W.equals(key)
                || FACTORY_TEST_27W.equals(key);
    }

    private boolean isStringStyle(String key) {
        return PREFIX.equals(key)
                || SUFFIX.equals(key)
                || DEV_BROADCAST.equals(key)
                || DEV_DATAKEY.equals(key)
                || DEV_START.equals(key)
                || DEV_STOP.equals(key)
                || "filterString".equals(key)
                || "embededPwd".equals(key)
                || "region".equals(key)
                || SCAN_KEY.equals(key);
    }

    private boolean isIntStyle(String key) {
        return DATA_START.equals(key)
                || DATA_LEN.equals(key)
                || SENDMODE.equals(key)
                || ENDCHAR.equals(key)
                || INTERVAL_CHAR.equals(key)
                || PART_OF_CARD.equals(key)
                || "filterBank".equals(key)
                || "filterAddress".equals(key)
                || "filterLenth".equals(key)
                || "filterMatch".equals(key)
                || "embededBank".equals(key)
                || "embededAddress".equals(key)
                || "embededLenth".equals(key)
                || "soundRepeat".equals(key)
                || "export".equals(key)
                || "tidSort".equals(key)
                || "moduleType".equals(key);
    }

    public void initDefDeveloper() {
        if (mPreferences == null) {
            mPreferences = mContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_WORLD_WRITEABLE);
        }
        Editor editor = mPreferences.edit();
        editor.putString(DEV_BROADCAST, DEF_BROADCAST);
        editor.putString(DEV_DATAKEY, DEF_KEY);
        editor.putString(DEV_START, DEF_START);
        editor.putString(DEV_STOP, DEF_STOP);
        editor.putBoolean(DEV_ADD_ENTER, DEF_ADD_ENTER);
        editor.commit();
    }


    public boolean getInventoryFlag() {
        SharedPreferences preferences = mContext.getSharedPreferences("settings", Context.MODE_PRIVATE);
        return preferences.getBoolean("inventory", false);
    }

    public void setInventoryFlag(boolean inventoryFlag) {
        SharedPreferences.Editor editor = mContext.getSharedPreferences("settings", Context.MODE_WORLD_WRITEABLE).edit();
        editor.putBoolean("inventory", inventoryFlag);
        LogUtil.i(TAG, "setInventoryFlag: " + inventoryFlag);
        editor.apply();
    }

    public void initDef() {
        Editor editor = mPreferences.edit();
        editor.putBoolean(BOOTSTART, DEF_bootStart);
        editor.putBoolean(PLAYSOUND, DEF_palySound);
        editor.putBoolean(VIBRATE, DEF_vibrate);
        editor.putBoolean(GO_STOP, DEF_goStop);
        editor.putBoolean(ENDCHAR_ON_EMU, DEF_endcharOnEmu);
        editor.putString(PREFIX, "");
        editor.putString(SUFFIX, "");
        editor.putInt(ENDCHAR, DEF_ENDCHAR);
        editor.putInt(INTERVAL_CHAR, DEF_INTERVAL_CHAR);
        editor.putInt(SENDMODE, DEF_SENDMODE);
        editor.putString(SCAN_KEY, DEF_SCAN_KEY);
        editor.putInt(PART_OF_CARD, EPC);
        editor.putInt(DATA_START, 0);
        editor.putInt(DATA_LEN, 0);
        editor.putBoolean("inventory", false);
        editor.apply();
        initDefDeveloper();
    }
}
