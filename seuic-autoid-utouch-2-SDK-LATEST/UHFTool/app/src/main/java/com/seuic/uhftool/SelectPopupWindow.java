package com.seuic.uhftool;

import java.util.HashMap;
import java.util.Map;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.drawable.ColorDrawable;
import android.util.DisplayMetrics;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.View.OnTouchListener;
import android.view.ViewGroup;
import android.view.ViewGroup.LayoutParams;
import android.widget.AdapterView;
import android.widget.AdapterView.OnItemClickListener;
import android.widget.BaseAdapter;
import android.widget.ListView;
import android.widget.PopupWindow;
import android.widget.TextView;
import android.widget.Toast;

import com.seuic.uhf.UHFService;
import com.seuic.uhftool.activity.FragmentFactory;
import com.seuic.uhftool.activity.SeekFragment;
import com.seuic.uhftool.util.ServiceUtil;

public class SelectPopupWindow extends PopupWindow {

	private View mMenuView;
	
	private ListView lst_settings;
	
	private LayoutInflater mInflater;
	
	private static Map<Integer, SettingItem> settingMap;

	private static final int EXIT = 0;
	private static final int VERSION = 1;
	private static final String ACTION_UHF_SERVICE_TERMINATE = "com.android.uhf.TERMINATE";

	UHFService mService;
	private static Activity mContext;
	
	static {
		settingMap = new HashMap<Integer, SettingItem>();
	}
	
	public SelectPopupWindow(final Activity context){
		mContext = context;

		refresh();
		if (mService == null) {
			mService = UHFService.getInstance();
		}
		mInflater = (LayoutInflater) mContext
				.getSystemService(Context.LAYOUT_INFLATER_SERVICE);
		mMenuView = mInflater.inflate(R.layout.popup, null);
		
		DisplayMetrics dm = new DisplayMetrics();
        mContext.getWindowManager().getDefaultDisplay().getMetrics(dm);
        
		int sWidth = dm.widthPixels;

		registerTERMINATEReceiver();

		lst_settings = (ListView) mMenuView.findViewById(R.id.lst_settings);
		lst_settings.setAdapter(new SettingAdapter());
		lst_settings.setOnItemClickListener(new OnItemClickListener() {

			@Override
			public void onItemClick(AdapterView<?> arg0, View arg1, int arg2,
					long arg3) {
				SeekFragment fragment = (SeekFragment) FragmentFactory.getFragmentByIndex(R.id.rb_inventory);
				switch (arg2) {
					case EXIT:
						AppCache.setOpened(false);
						mService.inventoryStop();
						ServiceUtil mServiceUtil = ServiceUtil.getSingleStance();
						mServiceUtil.stop(mContext.getApplicationContext());
						unRegisterTERMINATEReceiver();
						mContext.finish();
						break;

					case VERSION:
						if(fragment.mInventoryStart||fragment.isstart ) {
							Toast.makeText(mContext, mContext.getString(R.string.stop_inventory), Toast.LENGTH_SHORT).show();
							break;
						}
						String version = mService.getFirmwareVersion();
						AlertDialog alertDialog2 = new AlertDialog.Builder(mContext)
								.setTitle(mContext.getResources().getString(R.string.soft_version))
								.setMessage(version)
								.setIcon(R.drawable.ic_launcher)
								.setPositiveButton(mContext.getResources().getString(R.string.msg_confirm), new DialogInterface.OnClickListener() {
									@Override
									public void onClick(DialogInterface dialogInterface, int i) {

									}
								}).create();
						alertDialog2.show();
						dismiss();
						break;

					default:
						break;
				}
			}
		});

		this.setContentView(mMenuView);
		this.setWidth(sWidth/2);
		this.setHeight(LayoutParams.WRAP_CONTENT);
		this.setFocusable(true);
		ColorDrawable dw = new ColorDrawable(0000000000);
		this.setBackgroundDrawable(dw);
		mMenuView.setOnTouchListener(new OnTouchListener() {

			public boolean onTouch(View v, MotionEvent event) {
				
				int height = mMenuView.findViewById(R.id.pop_layout).getTop();
				int y=(int) event.getY();
				if(event.getAction()==MotionEvent.ACTION_UP){
					if(y<height){
						dismiss();
					}
				}				
				return true;
			}
		});
	}

	class SettingAdapter extends BaseAdapter{

		@Override
		public int getCount() {
			return settingMap.size();
		}

		@Override
		public Object getItem(int position) {
			return settingMap.get(position);
		}

		@Override
		public long getItemId(int position) {
			return position;
		}

		@Override
		public View getView(int position, View convertView, ViewGroup parent) {
			SettingItem item = settingMap.get(position);
			View view = mInflater.inflate(R.layout.poputpitem, null);
			TextView txt = (TextView) view.findViewById(R.id.txt_popumtext);	
			txt.setText(item.getName());
			return view;
		}

	}

	public void refresh(){
		settingMap.put(EXIT, new SettingItem(mContext.getResources().getString(R.string.msg_exit)));
		settingMap.put(VERSION, new SettingItem(mContext.getResources().getString(R.string.soft_version)));
	}

	class TERMINATEReceiver extends BroadcastReceiver {
		@Override
		public void onReceive(Context context, Intent intent) {
			if (ACTION_UHF_SERVICE_TERMINATE.equals(intent.getAction())) {
				mContext.finish();
			}
		}
	}

	TERMINATEReceiver terminateReceiver;

	public void registerTERMINATEReceiver() {
		terminateReceiver = new TERMINATEReceiver();
		IntentFilter intentFilter = new IntentFilter();
		intentFilter.addAction(ACTION_UHF_SERVICE_TERMINATE);
		mContext.registerReceiver(terminateReceiver, intentFilter);
	}

	public void unRegisterTERMINATEReceiver() {
		if (terminateReceiver != null) {
			mContext.unregisterReceiver(terminateReceiver);
			terminateReceiver = null;
		}
	}
}

class SettingItem{
	String name;
	public SettingItem(String name) {
		this.name = name;
	}
	public String getName() {
		return name;
	}
	public void setName(String name) {
		this.name = name;
	}
}
