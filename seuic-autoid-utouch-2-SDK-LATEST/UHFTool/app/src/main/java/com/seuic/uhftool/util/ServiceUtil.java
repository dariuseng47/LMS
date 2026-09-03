package com.seuic.uhftool.util;

import android.app.Service;
import android.content.Context;
import android.content.Intent;

public class ServiceUtil {

    static ServiceUtil mUtil;

    private Intent mIntent;

    private Context mContext;
    private Class<? extends Service> mservice;

    public static ServiceUtil getSingleStance() {
        if (mUtil == null) {
            mUtil = new ServiceUtil();
        }
        return mUtil;
    }

    public void start(Context context, Class<? extends Service> service) {
        mContext = context.getApplicationContext();
        mservice = service;
        Thread thread = new Thread(new Runnable() {
            @Override
            public void run() {
                mIntent = new Intent(mContext, mservice);
                LogUtil.i("UHF", mIntent.toString());
                mContext.startForegroundService(mIntent);
            }
        });
        thread.start();
    }

    public void stop(Context context) {
        if (mIntent != null) {
            context.stopService(mIntent);
            LogUtil.i("UHF", "stopService "+mIntent.toString());
        }
    }
}
