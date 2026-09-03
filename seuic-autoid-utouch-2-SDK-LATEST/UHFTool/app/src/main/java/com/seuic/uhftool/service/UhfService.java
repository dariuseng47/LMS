package com.seuic.uhftool.service;

import java.lang.reflect.Method;
import java.util.List;

import android.annotation.SuppressLint;
import android.app.KeyguardManager;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Handler;
import android.os.IBinder;
import android.os.Message;
import android.os.PowerManager;
import android.os.RemoteException;
import android.view.KeyCharacterMap;
import android.view.KeyEvent;
import android.view.inputmethod.InputMethodManager;

import com.seuic.scankey.IKeyEventCallback;
import com.seuic.uhf.EPC;
import com.seuic.uhf.IReadTagsListener;
import com.seuic.scankey.ScanKeyService;
import com.seuic.uhf.UHFService;

import com.seuic.uhftool.receiver.SettingsReceiver;
import com.seuic.uhftool.util.BaseUtil;
import com.seuic.uhftool.util.DisplayUtil;
import com.seuic.uhftool.util.LogUtil;
import com.seuic.uhftool.util.ServiceUtil;
import com.seuic.uhftool.util.ThreadUtils;
import com.seuic.uhftool.*;

import org.greenrobot.eventbus.EventBus;

import static com.seuic.uhftool.activity.MainActivity.progressBar;
import static com.seuic.uhftool.activity.SeekFragment.isstart;
import static com.seuic.uhftool.activity.SeekFragment.mInvModeValid;

public class UhfService extends Service {

    private static final String TAG = "UhfService";

    private static final int SEND_BARCODE = 100;
    private static final int SEND_BARCODE_ONCE = 200;
    private static final int SEND_INIT_MSG = 302;
    private final int NOTIFYCATION_ID = 20180918;
    public static final String ACTION_UHF_SETTINGS = "com.seuic.uhftool.settings";
    public static final String MODEL_D500B = "D500B";
    public static final String MODEL_R109 = "R109";

    private SettingsReceiver mSettingsReceiver;

    public static boolean uhfserver_isStart = false;

    public static boolean isSmall= false;

    InputMethodManager inputMethodManager;

    ScanKeyService mScanKeyService;

    UHFService mService;

    Appconfig mConfig;
    BarcodeConfig mBarcodeConfig;

    UHFLogic mLogic;

    Cache mEPCUtil;

    Intent sendIntent;

    PowerManager pm;
    KeyguardManager keyguardManager = null;
    PowerManager.WakeLock wakeLock = null;

    CustomNotification mCustomNotification;

    private final BroadcastReceiver localeChangeReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent.getAction().equals(Intent.ACTION_LOCALE_CHANGED)) {
                restartNotify();
            }
        }
    };

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public boolean onUnbind(Intent intent) {
        return super.onUnbind(intent);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        LogUtil.i(TAG, "onCreate");
        registerScreenReceiver();
        registerTERMINATEReceiver();
        mService = UHFService.getInstance();
        pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        mBarcodeConfig = BarcodeConfig.getInstance(this);
        mCustomNotification = new CustomNotification(this);
        mCustomNotification.startNotifyOnService(NOTIFYCATION_ID, this);
        uhfserver_isStart = true;

        if (null == mSettingsReceiver) {
            IntentFilter mSettingsConfigFilter = new IntentFilter();
            mSettingsConfigFilter.addAction(ACTION_UHF_SETTINGS);
            mSettingsReceiver = new SettingsReceiver();
            registerReceiver(mSettingsReceiver,mSettingsConfigFilter);
        }
        registerReceiver(localeChangeReceiver, new IntentFilter(Intent.ACTION_LOCALE_CHANGED));
    }

    @SuppressLint("InvalidWakeLockTag")
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        LogUtil.i(TAG, "onStartCommand");
        mLogic = new UHFLogic(this);
        mConfig = Appconfig.getInstance(this);
        mEPCUtil = Cache.getInstance(this);
        keyguardManager = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
        isScreenOn = pm.isScreenOn();
        Thread thread = new Thread(new Runnable() {
            @Override
            public void run() {
                if (isScreenOn && !isOpen) {
                    try{
                        if(mService.open()) {
                            if (mConfig.moduleType == 0) {
                                String version = mService.getFirmwareVersion();
                                if (version != null) {
                                    if (version.equals("2.6.0.240"))
                                        mConfig.set("moduleType", 1);
                                    else
                                        mConfig.set("moduleType", 2);
                                }
                            }
                            if (mConfig.moduleType == 2) {
                                if((DisplayUtil.getUhfPad().equals("E710")||DisplayUtil.getUhfPad().equals("E510")) && DisplayUtil.isOnGMS())
                                    mService.setRegion("ETSI");
                                else if (DisplayUtil.getUhfPad().contains("-EU") || DisplayUtil.isGMS())
                                    mService.setRegion("ETSI");
                                else
                                    mService.setRegion(mConfig.region);
                            }
                            setParam();

                            if (mConfig.isEmbeded)
                                setEmbeded();

                            isOpen = true;
                            isRunning = false;
                            mThRunning = false;
                            mInventoryStart = false;
                            LogUtil.i(TAG, "UHF is open..");
                        } else {
                            LogUtil.i(TAG, "UHF is open false.");
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                        LogUtil.e(TAG, "UHF err: "+e.getMessage());
                        uhfserver_isStart = false;
                        System.exit(0);
                    }
                }
                mHandler.sendEmptyMessage(SEND_INIT_MSG);
            }
        });
        thread.start();

        // register scan key
        mScanKeyService = ScanKeyService.getInstance();
        try {
            if (DisplayUtil.getModel().equals(MODEL_D500B))
                mScanKeyService.registerCallback(mCallback, "248,249");//Here is the registration for scanning key monitoring.  248 represents the left scanning key, and 249 represents the rightscanning key
            else
                mScanKeyService.registerCallback(mCallback, "248,250");//Here is the registration for scanning key monitoring. 248 represents the left scanning key, and 250 represents the bottom handle scanning key
        } catch (Exception e) {
            LogUtil.e(TAG, e.toString());
        }
        registerUHFReceiver();

        mService.registerReadTags(mIReadTagsListener);

        wakeLock = pm.newWakeLock(PowerManager.SCREEN_DIM_WAKE_LOCK, "service");

        return super.onStartCommand(intent, flags, startId);
    }

    public void restartNotify(){
        mCustomNotification.stopNotifyWithService(this);
        mCustomNotification.startNotifyOnService(NOTIFYCATION_ID ,this);
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        mConfig.isSpecial = false;
        mConfig.isFilter = false;
        try {
            mScanKeyService.unregisterCallback(mCallback);
        } catch (Exception e) {
            LogUtil.e(TAG, e.toString());
        }
        mService.close();
        isOpen = false;
        mService.unregisterReadTags(mIReadTagsListener);
        unRegisterUHFReceiver();
        unRegisterScreenReceiver();
        unRegisterTERMINATEReceiver();
        mCustomNotification.stopNotifyWithService(this);
        mEPCUtil.clear();
        uhfserver_isStart = false;
        AppCache.ledfun = false;

        if (mSettingsReceiver != null) {
            unregisterReceiver(mSettingsReceiver);
            mSettingsReceiver = null;
        }
        unregisterReceiver(localeChangeReceiver);
    }

    private IReadTagsListener mIReadTagsListener = new IReadTagsListener() {
        @Override
        public void tagsRead(List<EPC> epcList) {
            mEPCUtil.getBacks().addAll(epcList);
        }
    };

    private IKeyEventCallback mCallback = new IKeyEventCallback.Stub() {
        @Override
        public void onKeyDown(int keyCode) throws RemoteException {
            EventBus.getDefault().post(new String("keyDown"));
            if (AppCache.isScanEnable() && isScreenOn && isOpen && (keyguardManager != null) && !keyguardManager.inKeyguardRestrictedInputMode()) {
                if (isstart) {
                    sendKeyBroadcast("ledstop");
                    if (wakeLock != null && wakeLock.isHeld()) {
                        wakeLock.setReferenceCounted(false);
                        wakeLock.release();
                    }
                    return;
                }
                doOnKeyDown();
            }
        }

        @Override
        public void onKeyUp(int keyCode) throws RemoteException {
            if (mConfig.continueSeek && mConfig.goStop &&
                    isScreenOn && isOpen && AppCache.isScanEnable() && (keyguardManager != null) && !keyguardManager.inKeyguardRestrictedInputMode()) {
                if (AppCache.ledfun) {
                    sendKeyBroadcast("ledstop");
                    if (wakeLock != null && wakeLock.isHeld()) {
                        wakeLock.setReferenceCounted(false);
                        wakeLock.release();
                    }
                } else {
                    doOnKeyUp();
                }
            }
        }
    };

    /**
     *
     *
     * @return
     */
    public synchronized void doOnKeyDown() {

        boolean result;
        if (Appconfig.TID == mConfig.partOfCard) {
            return;
        }
        if (mConfig.continueSeek) {
            if (!mConfig.goStop && mInventoryStart) {
                ThreadUtils.runOnSubThread(new Runnable() {
                    @Override
                    public void run() {
                    if (AppCache.ledfun) {
                        if (isstart) {
                            sendKeyBroadcast("ledstop");
                            if (wakeLock != null && wakeLock.isHeld()) {
                                wakeLock.setReferenceCounted(false);
                                wakeLock.release();
                            }
                        }
                    } else {
                        seekCtnStop();
                    }
                    }
                });
            } else {
                if (!mInventoryStart) {
                    ThreadUtils.runOnSubThread(new Runnable() {
                        @Override
                        public void run() {
                        if (AppCache.ledfun) {
                            if (isstart) {
                                sendKeyBroadcast("ledstop");
                                if (wakeLock != null && wakeLock.isHeld()) {
                                    wakeLock.setReferenceCounted(false);
                                    wakeLock.release();
                                }
                            } else {
                                sendKeyBroadcast("ledstart");
                                if (null != wakeLock) {
                                    wakeLock.acquire();
                                }
                            }
                        } else {
                            seekCtnStart();
                        }
                        }
                    });
                }
            }
        } else {
            seekOnce();
        }
    }

    /**
     *
     */
    public synchronized void doOnKeyUp() {
        if (mInventoryStart) {
            ThreadUtils.runOnSubThread(new Runnable() {
                @Override
                public void run() {
                    if (mInventoryStart) {
                        seekCtnStop();
                    }
                }
            });
        }
    }

    @SuppressLint("HandlerLeak")
    Handler mHandler = new Handler() {
        @Override
        public void handleMessage(Message msg) {
            switch (msg.what) {
                case SEND_BARCODE:
                    sendBarcode(mConfig.devBroadcast);
                    break;
                case SEND_BARCODE_ONCE:
                    sendBarcode(mConfig.devBroadcast);
                    break;
                case SEND_INIT_MSG:
                    if (progressBar != null)
                        progressBar.dismiss();
                default:
                    break;
            }
        }
    };

    private boolean seekOnce() {
        if (mConfig.isFilter && mConfig.moduleType == 2) {
            setFilter_run();
        }
        if (mBarcodeConfig.getValue("PARAMETER_CLEAR_EPCLIST_WHEN_START_INVENTORY", 1) == 1)
            mEPCUtil.clear();
        boolean result = mLogic.inventoryOnce(mEPCUtil);
        mHandler.sendEmptyMessage(SEND_BARCODE_ONCE);
        return result;
    }

    private boolean seekCtnStart() {
        if (mThRunning)
            return false;

        if (!mInvModeValid) {
            LogUtil.i(TAG, "mInvModeValid = "+mInvModeValid);
            return false;
        }
        boolean result;

        if (mConfig.isFilter && mConfig.moduleType == 1) {
            if (!mConfig.filterString.isEmpty()) {
                byte[] con = BaseUtil.getHexByteArray(mConfig.filterString);
                result = mService.inventorySelectStart(con, mConfig.filterAddress, mConfig.filterLenth);
            } else
                result = mService.inventoryStart();
        } else {
            if (mConfig.isFilter) {
                setFilter_run();
            }
            result = mService.inventoryStart();
        }

        if (result) {
            sendKeyBroadcast("start");
            if (mBarcodeConfig.getValue("PARAMETER_CLEAR_EPCLIST_WHEN_START_INVENTORY", 1) == 1)
                mEPCUtil.clear();
            inventoryThread = new InventoryThread();
            soundThread = new SoundThread();
            isRunning = true;
            mInventoryStart = true;
            inventoryThread.start();
            soundThread.start();
            if (null != wakeLock) {
                wakeLock.acquire();
            }
        }
        return result;
    }

    public boolean setFilter_run() {
        byte[] val = new byte[255];
        val[0] = (byte) mConfig.filterBank;
        val[1] = (byte) mConfig.filterAddress;
        val[2] = (byte) mConfig.filterLenth;
        val[3] = (byte) mConfig.filterMatch;
        byte[] data = BaseUtil.getHexByteArray(mConfig.filterString);
        if ((data == null)) {
            return false;
        } else {
            if ((val[2] != data.length)) {
                return false;
            }
            System.arraycopy(data, 0, val, 4, val[2]);
            mService.setParamBytes(UHFService.PARAMETER_TAG_FILTER, val);
        }
        return true;
    }

    volatile boolean isRunning;
    public static boolean isOpen = false;
    volatile boolean mseekCtnStopRunning = false;

    /**
     *
     *
     * @return
     */
    private boolean seekCtnStop() {
        boolean result;
        result = mLogic.inventoryStop();
        if (!result) {
            return false;
        }

        sendKeyBroadcast("stop");

        if (inventoryThread == null) {
            return false;
        }
        if (mseekCtnStopRunning == true)
            return false;

        mseekCtnStopRunning = true;
        try {
            mInventoryStart = false;
            try {
                inventoryThread.join();
                soundThread.join();
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.setReferenceCounted(false);
                wakeLock.release();
            }
            inventoryThread = null;
            soundThread = null;
        } catch (Exception e) {
            LogUtil.e(TAG, "seekCtnStop err", e);
        }
        isRunning = false;
        mseekCtnStopRunning = false;

        mLogic.outTxt(mEPCUtil.getAllEpcs());
        return result;
    }

    private void sendBarcode(String action) {
        String barcode = mEPCUtil.getBarcode();
        if (AppCache.isMainShown() || Appconfig.SENDMODE_BROADCAST == mConfig.sendmode) {
            if ((barcode == null || barcode.isEmpty()) && !AppCache.isMainShown()) {
                return;
            }
            if (sendIntent == null || !sendIntent.getAction().equals(action)) {
                sendIntent = new Intent();
                sendIntent.addFlags(Intent.FLAG_RECEIVER_FOREGROUND);
                sendIntent.setAction(action);
            }
            if(isSmall){
                sendIntent.putExtra(mConfig.devDatakey, barcode);
                sendIntent.putExtra("enter", mConfig.dev_add_enter);
                sendIntent.putExtra("append", true);
            }else{
                if (!AppCache.isMainShown()) {
                    sendIntent.putExtra(mConfig.devDatakey, barcode);
                    sendIntent.putExtra("enter", mConfig.dev_add_enter);
                    sendIntent.putExtra("append", true);
                } else {
                    sendIntent.removeExtra(mConfig.devDatakey);
                    sendIntent.removeExtra("enter");
                    sendIntent.removeExtra("append");
                }
            }
            sendBroadcast(sendIntent);
            if (!barcode.equals(""))
                LogUtil.d(TAG, "sendBarcode broadcast : " + barcode);
        } else if (Appconfig.SENDMODE_FOCUS == mConfig.sendmode) {
            if (barcode != null && barcode.length() != 0) {
                sendByFocus(barcode);
                if (mConfig.endcharOnEmu) {
                    try {
                        Thread.sleep(30);
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                    sendByEmuKey(mLogic.getEndChar());
                }
            }
        }
    }

    /***
     *
     * @param text  ：\n  \t  space
     *
     */
    private void sendByEmuKey(String text) {
        StringBuilder buff = new StringBuilder(text);
        KeyCharacterMap mKeyCharacterMap = KeyCharacterMap.load(KeyCharacterMap.VIRTUAL_KEYBOARD);
        for (int i = 0; i < buff.length(); i++) {
            char[] temp = {buff.charAt(i)};
            if (null == mKeyCharacterMap.getEvents(temp)) {
                buff.setCharAt(i, '@');
            }
        }

        char[] chars = buff.toString().toCharArray();
        final KeyEvent[] events = mKeyCharacterMap.getEvents(chars);

        try {
            Class<?> c1 = Class.forName("android.hardware.input.InputManager");
            Method[] methods = c1.getDeclaredMethods();
            for (Method method : methods) {
                if (method.getName().equals("getInstance")) {
                    method.setAccessible(true);
                    Object object = method.invoke(null, new Object[]{});
                    if (object != null) {
                        Class<?> c2 = Class.forName(object.getClass().getName());
                        Method[] methods2 = c2.getDeclaredMethods();
                        for (Method method2 : methods2) {
                            if (method2.getName().equals("injectInputEvent")) {
                                method2.setAccessible(true);
                                for (int i = 0; i < events.length; i++) {
                                    KeyEvent event = events[i];
                                    method2.invoke(object, event, 2);
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception ex) {
            LogUtil.e(TAG, "sendByEmuKey : " + ex.getMessage());
        }
    }

    private void sendByFocus(String barcode) {
        if (inputMethodManager == null) {
            inputMethodManager = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        }
        Class<?> inputMethodMgrCls = InputMethodManager.class;
        try {
            Method setCommitText = inputMethodMgrCls.getDeclaredMethod("setCommitText", String.class);
            setCommitText.setAccessible(true);
            setCommitText.invoke(inputMethodManager, barcode);
            LogUtil.i(TAG, "sendByFocus: " + barcode);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    UHFReceiver uhfReceiver;

    private boolean mReceiverTag = false;

    private void registerUHFReceiver() {
        if (!mReceiverTag) {
            if (uhfReceiver != null) {
                unRegisterUHFReceiver();
                uhfReceiver = null;
            }
            uhfReceiver = new UHFReceiver();
            IntentFilter uhfFilter = new IntentFilter();
            uhfFilter.addAction(mConfig.devStart);
            uhfFilter.addAction(mConfig.devStop);
            registerReceiver(uhfReceiver, uhfFilter);
            mReceiverTag = true;
        }

    }

    private void unRegisterUHFReceiver() {
        if (mReceiverTag) {
            try {
                if (uhfReceiver == null) {
                    uhfReceiver = new UHFReceiver();
                }
                unregisterReceiver(uhfReceiver);
            } catch (Exception e) {
                e.printStackTrace();
                LogUtil.e(TAG, "unregisterUHFReceiver", e);
            } finally {
                uhfReceiver = null;
            }
            mReceiverTag = false;
        }

    }

    InventoryThread inventoryThread;
    SoundThread soundThread;

    public static boolean mInventoryStart = false;
    public boolean mThRunning = false;

    /**
     * seek continue mode
     *
     * @author www
     */
    private class InventoryThread extends Thread {

        @Override
        public void run() {
            mThRunning = true;
            while (mInventoryStart && (keyguardManager != null) && !keyguardManager.inKeyguardRestrictedInputMode()) {
                try {
                    sleep(50);
                    mEPCUtil.loadData_new();
                } catch (Exception e) {
                    LogUtil.i(TAG, "Inventory thread interrupted");
                }
                if (!mInventoryStart) {
                    sendKeyBroadcast("stop");
                }
                if (!AppCache.isScanEnable()) {
                    mLogic.inventoryStop();
                    mLogic.outTxt(mEPCUtil.getAllEpcs());
                    mInventoryStart = false;
                } else {
                    mHandler.sendEmptyMessage(SEND_BARCODE);
                }
            }
            mInventoryStart = false;
            mHandler.removeMessages(SEND_BARCODE);
            sendKeyBroadcast("stop");
            mThRunning = false;
        }
    }

    private class SoundThread extends Thread {
        @Override
        public void run() {
            while (mInventoryStart) {
                try {
                    sleep(50);
                    if (mConfig.soundRepeat == 1) {
                        if (mEPCUtil.compareNumsAll() || mEPCUtil.compareNums()) {
                            mEPCUtil.playsound();
                            sleep(50);
                            mEPCUtil.playsound();
                        }
                    }else{
                        if (mEPCUtil.compareNums()) {
                            mEPCUtil.playsound();
                        }
                    }
                } catch (Exception e) {
                    LogUtil.i(TAG, "Inventory thread interrupted");
                }
            }
        }
    }

    /**
     * The UHFReceiver desiged for developer
     * start or stop uhf scan whith broadcast
     *
     * @author seuic_chenkun
     */
    class UHFReceiver extends BroadcastReceiver {

        @Override
        public void onReceive(Context context, Intent intent) {
            if (mConfig.devStart.equals(intent.getAction())) {
                if (mConfig.continueSeek) {
                    seekCtnStart();
                } else {
                    seekOnce();
                }
            } else if (mConfig.devStop.equals(intent.getAction())) {
                if (mConfig.continueSeek) {
                    seekCtnStop();
                }
            }
        }

    }

    private boolean isScreenOn = false;

    public static final String ACTION_SCREENOFF = "android.intent.action.SCREEN_OFF";

    public static final String ACTION_SCREENON = "android.intent.action.SCREEN_ON";

    ScreenReceiver mScreenReceiver;

    private void registerScreenReceiver() {
        mScreenReceiver = new ScreenReceiver();
        IntentFilter screenFilter = new IntentFilter();
        screenFilter.addAction(ACTION_SCREENOFF);
        screenFilter.addAction(ACTION_SCREENON);
        registerReceiver(mScreenReceiver, screenFilter);
    }

    private void unRegisterScreenReceiver() {
        if (mScreenReceiver != null) {
            unregisterReceiver(mScreenReceiver);
            mScreenReceiver = null;
        }
    }

    class ScreenReceiver extends BroadcastReceiver {

        @Override
        public void onReceive(Context context, Intent intent) {
            if (ACTION_SCREENON.equals(intent.getAction())) {
                LogUtil.i(TAG, "onReceive: ACTION_SCREENON");
                isScreenOn = true;
                keyguardManager = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
                if (!isOpen) {
                    boolean res = mService.open();
                    LogUtil.i(TAG, "UHF is open: " + res);
                    if (res) {
                        if (mConfig.moduleType == 0) {
                            String version = mService.getFirmwareVersion();
                            if (version != null) {
                                if (version.equals("2.6.0.240"))
                                    mConfig.set("moduleType", 1);
                                else
                                    mConfig.set("moduleType", 2);
                            }
                        }
                        if (mConfig.moduleType == 2) {
                            if((DisplayUtil.getUhfPad().equals("E710")||DisplayUtil.getUhfPad().equals("E510")) && DisplayUtil.isOnGMS())
                                mService.setRegion("ETSI");
                            else if (DisplayUtil.getUhfPad().contains("-EU") || DisplayUtil.isGMS())
                                mService.setRegion("ETSI");
                            else
                                mService.setRegion(mConfig.region);
                        }
                        setParam();

                        if (mConfig.isEmbeded)
                            setEmbeded();

                        isOpen = true;
                    }
                }
                isRunning = false;
                mThRunning = false;
                mInventoryStart = false;
            } else if (ACTION_SCREENOFF.equals(intent.getAction())) {
                LogUtil.i(TAG, "onReceive: ACTION_SCREENOFF");
                if (isRunning)
                    seekCtnStop();

                if (wakeLock != null && wakeLock.isHeld()) {
                    wakeLock.setReferenceCounted(false);
                    wakeLock.release();
                    LogUtil.i(TAG, "wakeLock.release");
                }
                isScreenOn = false;
                isRunning = false;
                mService.close();
                isOpen = false;
                keyguardManager = null;
            }
        }
    }

    private boolean sendKeyBroadcast(String info) {
        Intent intent = new Intent("com.seuic.uhftool.service." + info);
        intent.addFlags(Intent.FLAG_RECEIVER_FOREGROUND);
        sendBroadcast(intent);
        return true;
    }

    private boolean setParam() {
        mBarcodeConfig.setPower(mBarcodeConfig.getValue("power", 30));

        int getsession = mBarcodeConfig.getValue("PARAMETER_INVENTORY_SESSION", 1);
        if (!mService.setParameters(UHFService.PARAMETER_INVENTORY_SESSION, getsession))
            return false;

        int getprofile = mBarcodeConfig.getValue("PARAMETER_LINK_PROFILE", 1);
        mService.setParameters(UHFService.PARAMETER_LINK_PROFILE, getprofile);

        int gettarget = mBarcodeConfig.getValue("PARAMETER_INVENTORY_SESSION_TARGET", 0);
        mService.setParameters(UHFService.PARAMETER_INVENTORY_SESSION_TARGET, gettarget);

        int gettagFocus = mBarcodeConfig.getValue("PARAMETER_EXTENSIONS_TAGFOCUS", 0);
        mService.setParameters(UHFService.PARAMETER_EXTENSIONS_TAGFOCUS, gettagFocus);

        int getfastid = mBarcodeConfig.getValue("PARAMETER_EXTENSIONS_FASTID", 0);
        mService.setParameters(UHFService.PARAMETER_EXTENSIONS_FASTID, getfastid);

        int clearStart = mBarcodeConfig.getValue("PARAMETER_CLEAR_EPCLIST_WHEN_START_INVENTORY", 1);
        mService.setParameters(UHFService.PARAMETER_CLEAR_EPCLIST_WHEN_START_INVENTORY, clearStart);

        mService.setParameters(UHFService.PARAMETER_HIDE_PC, 1);

        int enableS2algorithm = mBarcodeConfig.getValue("PARAMETER_S2_ALGORITHM", 0);
        if(enableS2algorithm != 0)
            mService.setParameters(34, enableS2algorithm);
        return true;
    }

    private boolean setTagParam(int setPower, int setSession, int setProfile, int setTime, int setTarget) {
        if (!mBarcodeConfig.setPower(setPower)) {
            return false;
        }

        if (!mService.setParameters(UHFService.PARAMETER_INVENTORY_SESSION, setSession))
            return false;

        mService.setParameters(UHFService.PARAMETER_LINK_PROFILE, setProfile);
        mService.setParameters(UHFService.PARAMETER_INVENTORY_SESSION_TARGET, setTarget);
        return true;
    }

    private boolean setEmbeded() {
        byte[] embd = new byte[255];
        embd[0] = (byte) mConfig.embededBank;
        embd[1] = (byte) mConfig.embededAddress;
        embd[2] = (byte) mConfig.embededLenth;
        System.arraycopy(BaseUtil.getHexByteArray(mConfig.embededPwd), 0, embd, 3, 4);
        boolean ret = mService.setParamBytes(UHFService.PARAMETER_TAG_EMBEDEDDATA, embd);
        LogUtil.i(TAG, "setEmbeded = " + ret);
        return true;
    }

    private static final String ACTION_UHF_SERVICE_TERMINATE = "com.android.uhf.TERMINATE";

    class TERMINATEReceiver extends BroadcastReceiver {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (ACTION_UHF_SERVICE_TERMINATE.equals(intent.getAction())) {
                mService.inventoryStop();
                mService.close();
                ServiceUtil mServiceUtil = ServiceUtil.getSingleStance();
                mServiceUtil.stop(context);
                System.exit(0);
            }
        }
    }

    TERMINATEReceiver terminateReceiver;

    private void registerTERMINATEReceiver() {
        terminateReceiver = new TERMINATEReceiver();
        IntentFilter intentFilter = new IntentFilter();
        intentFilter.addAction(ACTION_UHF_SERVICE_TERMINATE);
        registerReceiver(terminateReceiver, intentFilter);
    }

    private void unRegisterTERMINATEReceiver() {
        if (terminateReceiver != null) {
            unregisterReceiver(terminateReceiver);
            terminateReceiver = null;
        }
    }

}
