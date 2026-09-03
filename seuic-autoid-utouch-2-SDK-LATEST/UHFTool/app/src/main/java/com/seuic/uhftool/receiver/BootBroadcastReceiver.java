package com.seuic.uhftool.receiver;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import com.seuic.uhftool.Appconfig;
import com.seuic.uhftool.service.UhfService;
import com.seuic.uhftool.util.DisplayUtil;
import com.seuic.uhftool.util.LogUtil;
import com.seuic.uhftool.util.ServiceUtil;

public class BootBroadcastReceiver extends BroadcastReceiver {

	static final String BOOT_ACTION = "android.intent.action.BOOT_COMPLETED";
	private static final String ACTION_UHF_SERVICE_TERMINATE = "com.android.uhf.TERMINATE";
	static Context mContext;

	Appconfig mConfig;

	private static final String TAG = "BootBroadcastReceiver";

	@Override
	public void onReceive(Context context, Intent intent) {

		mContext = context;
		mConfig = Appconfig.getInstance(mContext);
		if (BOOT_ACTION.equals(intent.getAction())) {
			LogUtil.i(TAG, "started");
			if (DisplayUtil.display(context)) {
				if (mConfig.bootStart) {
					try {
						Thread.sleep(1000);
					} catch (InterruptedException e) {
						e.printStackTrace();
					}
					ServiceUtil mServiceUtil = ServiceUtil.getSingleStance();
					mServiceUtil.start(mContext.getApplicationContext(), UhfService.class);
					LogUtil.i(TAG, "service started");
				}
			}

		}
	}
}
