package com.seuic.uhftool.receiver;

import static com.seuic.uhftool.BarcodeConfig.MODEL_POWER;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import com.seuic.uhf.UHFService;
import com.seuic.uhftool.Appconfig;
import com.seuic.uhftool.BarcodeConfig;

/**
 * @author www
 */
public class SettingsReceiver extends BroadcastReceiver{
	private static final String TAG = "SettingsReceiver";
	private static final String SETTINGS_KEY = "key";
	private static final String SETTINGS_VALUE = "value";
	Appconfig mConfig;
	BarcodeConfig mBarcodeConfig;
	UHFService mService;
	
	@Override
	public void onReceive(Context context, Intent intent) {
		Log.d(TAG, "action:"+intent.getAction());
		mConfig = Appconfig.getInstance(context);
		mBarcodeConfig = BarcodeConfig.getInstance(context);
		mService = UHFService.getInstance();

		if (intent.hasExtra(SETTINGS_KEY) && intent.hasExtra(SETTINGS_VALUE)) {
			String key = intent.getStringExtra(SETTINGS_KEY);
			String value = intent.getStringExtra(SETTINGS_VALUE);
			Log.d(TAG, "key:"+key+", value:"+value);
			if (key != null && value != null) {
				if (key.equals("power")) {
					mBarcodeConfig.setValue("power", Integer.parseInt(value));
					mBarcodeConfig.setValue(MODEL_POWER, Integer.parseInt(value)-1);
					mService.setPower(Integer.parseInt(value));
				}
				if (key.equals(Appconfig.PLAYSOUND)) {
					mConfig.set(Appconfig.PLAYSOUND, Boolean.parseBoolean(value));
				}

				if (key.equals(Appconfig.VIBRATE)) {
					mConfig.set(Appconfig.VIBRATE, Boolean.parseBoolean(value));
				}

				if (key.equals("uhf_boot_start")) {
					mConfig.set(Appconfig.BOOTSTART, Boolean.parseBoolean(value));
				}

				if (key.equals(Appconfig.CONTINUE_SEEK)) {
					mConfig.set(Appconfig.CONTINUE_SEEK, Boolean.parseBoolean(value));
				}

				if (key.equals(Appconfig.GO_STOP)) {
					mConfig.set(Appconfig.GO_STOP, Boolean.parseBoolean(value));
				}

				if (key.equals(Appconfig.PREFIX)) {
					mConfig.set(Appconfig.PREFIX, value);
				}

				if (key.equals(Appconfig.SUFFIX)) {
					mConfig.set(Appconfig.SUFFIX, value);
				}

				if (key.equals(Appconfig.ENDCHAR)) {
					mConfig.set(Appconfig.ENDCHAR, value);
				}

				if (key.equals(Appconfig.PART_OF_CARD)) {
					mConfig.set(Appconfig.PART_OF_CARD, value);
				}

				if (key.equals(Appconfig.DATA_START)) {
					mConfig.set(Appconfig.PART_OF_CARD, Integer.parseInt(value));
				}

				if (key.equals(Appconfig.DATA_LEN)) {
					mConfig.set(Appconfig.DATA_LEN, Integer.parseInt(value));
				}

				if (key.equals(Appconfig.SENDMODE)) {
					mConfig.set(Appconfig.SENDMODE, value);
				}

				if (key.equals(Appconfig.DEV_BROADCAST)) {
					mConfig.set(Appconfig.DEV_BROADCAST, value);
				}

				if (key.equals(Appconfig.DEV_DATAKEY)) {
					mConfig.set(Appconfig.DEV_DATAKEY, value);
				}
			}
		}
		
	}

}
