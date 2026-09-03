package com.seuic.uhftool.receiver;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import com.seuic.uhftool.service.UhfService;
import com.seuic.uhftool.util.ServiceUtil;

public class StartUHFReceiver extends BroadcastReceiver {

	private final static String ACTION_START_SCAN_SERVICE = "com.seuic.action.START_UHFSERVICE";
	@Override
	public void onReceive(Context context, Intent intent) {
		if (intent.getAction().equals(ACTION_START_SCAN_SERVICE)) {
			ServiceUtil mServiceUtil = ServiceUtil.getSingleStance();
			mServiceUtil.start(context.getApplicationContext(), UhfService.class);
		}
	}
}
