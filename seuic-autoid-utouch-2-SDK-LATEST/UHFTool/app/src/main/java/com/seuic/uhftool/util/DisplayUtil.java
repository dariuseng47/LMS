package com.seuic.uhftool.util;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import com.seuic.uhftool.activity.SelectActivity;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStreamReader;

public class DisplayUtil {

	public static final String FILE_PATH_UHF_PAD_INFO = "/sys/class/padinfo/uhf";

	private static final String ACTIVITY_NAME = SelectActivity.class.getPackage().getName() + "." + SelectActivity.class.getSimpleName();

	public static String getUhfPad(){
		return SystemProperties.get("sys.padinfo.uhf", "");
	}

	public static String getModel(){
		return SystemProperties.get("ro.product.internal", "");
	}

	public static boolean isGMS(){
		String ver = Build.DISPLAY;
		if(ver != null){
			return (ver.contains("G") && getUhfPad().equals("r2000H"));
		}
		return false;
	}

	public static boolean isOnGMS(){
		String ver = Build.DISPLAY;
		if(ver != null){
			return (ver.contains("_G_") || ver.contains("_R_"));
		}
		return false;
	}

	public static boolean display(Context context) {
		String line = null;
		File file = new File(FILE_PATH_UHF_PAD_INFO);
		if (file.isFile()) {
			BufferedReader bufferedReader;
			try {
				bufferedReader = new BufferedReader(new InputStreamReader(new FileInputStream(file), "GBK"));
				line = bufferedReader.readLine();
			} catch (IOException e) {
				e.printStackTrace();
			}
		}
		boolean display = false;
		if (line != null) {
			if (!line.equals("")) {
				enableComponent(context);
				display = true;
			} else {
				disableComponent(context);
				display = false;
			}
		}
		return display;
	}

	private static void disableComponent(Context context) {
		ComponentName name = new ComponentName(context, ACTIVITY_NAME);
		PackageManager pm = context.getPackageManager();
		pm.setComponentEnabledSetting(name, PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
	}

	private static void enableComponent(Context context) {
		ComponentName name = new ComponentName(context, ACTIVITY_NAME);
		PackageManager pm = context.getPackageManager();
		pm.setComponentEnabledSetting(name, PackageManager.COMPONENT_ENABLED_STATE_DEFAULT, PackageManager.DONT_KILL_APP);
	}
}
