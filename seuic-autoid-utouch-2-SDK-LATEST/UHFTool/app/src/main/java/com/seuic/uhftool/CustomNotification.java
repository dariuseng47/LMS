package com.seuic.uhftool;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;

import com.seuic.uhftool.activity.MainActivity;

import static android.content.Context.NOTIFICATION_SERVICE;

public class CustomNotification {

	private Context mContext;

	private Notification.Builder mBuilder;

	private NotificationManager mNotificationManager;

	public CustomNotification(Context context) {
		this.mContext = context;
		this.mBuilder = new Notification.Builder(mContext);
		this.mBuilder.setSmallIcon(R.drawable.ic_uhf_small);
		this.mNotificationManager = (NotificationManager) mContext.getSystemService(NOTIFICATION_SERVICE);
	}

	public void showRequestMsg(String title, String info) {
		Intent intent = new Intent(mContext, MainActivity.class);
		PendingIntent pendingIntent = PendingIntent.getActivity(mContext, 0, intent, 0);
		this.mBuilder.setAutoCancel(true);
		this.mBuilder.setContentTitle(title);
		this.mBuilder.setContentIntent(pendingIntent);
		this.mBuilder.setContentText(info);
		this.mBuilder.setFullScreenIntent(pendingIntent, true);
		this.mNotificationManager.notify(2, this.mBuilder.build());
	}

	public void cancel() {
		this.mNotificationManager.cancelAll();
	}

	public void startNotifyOnService(int nId, Service service) {
		this.mBuilder.setAutoCancel(false);
		this.mBuilder.setContentTitle(mContext.getResources().getString(R.string.service_start));
		this.mBuilder.setAutoCancel(true);
		if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
				NotificationChannel notificationChannel = new NotificationChannel("uhf", "uhf", NotificationManager.IMPORTANCE_LOW);
				notificationChannel.enableLights(false);
				notificationChannel.setShowBadge(false);
				notificationChannel.setLockscreenVisibility(Notification.VISIBILITY_SECRET);
				NotificationManager manager = (NotificationManager)mContext.getSystemService(NOTIFICATION_SERVICE);
				manager.createNotificationChannel(notificationChannel);
				mBuilder.setChannelId("uhf");
		}
		Notification notification = this.mBuilder.getNotification();
		notification.flags |= Notification.FLAG_NO_CLEAR;
		service.startForeground(nId, notification);
	}

	public void stopNotifyWithService(Service service) {
		service.stopForeground(true);
	}

}
