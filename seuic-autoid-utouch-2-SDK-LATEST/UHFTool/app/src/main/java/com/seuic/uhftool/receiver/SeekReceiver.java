package com.seuic.uhftool.receiver;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import com.seuic.uhftool.Appconfig;
import com.seuic.uhftool.util.BaseUtil;
import com.seuic.uhftool.UHFLogic;

public class SeekReceiver extends BroadcastReceiver {

	final String EPC = "Epc";
	
	final String PASSWORD = "PassWord";
	
	final String BANK = "Bank";
	
	final String OFFSET = "Offset";
	
	final String LEN = "Len";
	
	static final String SEEK_ACTION = "com.android.server.uhfseekservice.broadcast";
	
	static final String READ_ACTION = "com.android.server.uhfreadservice.broadcast";
	
	UHFLogic mLogic;
	
	Appconfig mConfig;

	@Override
	public void onReceive(Context context, Intent intent) {

		mLogic = new UHFLogic(context);
		mConfig = Appconfig.getInstance(context);
		if (SEEK_ACTION.equals(intent.getAction())) {
			// TODO
			
		} else if(READ_ACTION.equals(intent.getAction())) {
			if(intent.getStringExtra(EPC).isEmpty() || intent.getStringExtra(PASSWORD).isEmpty()) {
				byte[] data = new byte[64];
				boolean readResult = mLogic.readTag(intent.getStringExtra(EPC),
										intent.getStringExtra(PASSWORD), 
										String.valueOf(intent.getIntExtra(BANK, 3)), 
										String.valueOf(intent.getIntExtra(OFFSET, 0)), 
										String.valueOf(intent.getIntExtra(LEN, 1)), data);
				if(readResult) {
					String resultData = mLogic.addFrefixSuffix(BaseUtil.getHexString(data, mConfig.dataLen),false);
					Intent sendIntent = new Intent();
					sendIntent.setAction(mConfig.devBroadcast);
					sendIntent.putExtra(mConfig.devDatakey, resultData);
					context.sendBroadcast(sendIntent);
				}
			}

		}

	}

}
