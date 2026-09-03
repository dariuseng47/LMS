package com.seuic.uhftool.iml;

public interface IAppconfig {

	//
	String PREFERENCES_NAME = "settings";

	String PLAYSOUND = "playsound";

	String VIBRATE = "vibrate";

	String BOOTSTART = "bootstart";
	
	String CONTINUE_SEEK = "continue_seek";
	String CONTINUE_TIME = "continue_time";

	String GO_STOP = "go_stop";
	
	String PREFIX = "prefix";

	String SUFFIX = "suffix";

	String ENDCHAR = "endchar";

	int DEF_ENDCHAR = 3;

	String[] valueEndChar = new String[]{"ENTER", "TAB", "SPACE", "NONE"};

	String INTERVAL_CHAR = "interval_char";
	
	String[] valueIntervalChar = new String[]{"ENTER", "TAB", "SPACE", "NONE"};
	
	int DEF_INTERVAL_CHAR = 0;
	
	String SENDMODE = "sendmode";

	String SCAN_KEY = "scan_key";

	String DEF_SCAN_KEY = "250";
	
	int SENDMODE_FOCUS = 0;

	int SENDMODE_BROADCAST = 1;

	/** 0:焦点录入 1:广播 */
	int DEF_SENDMODE = SENDMODE_BROADCAST;

	String ENDCHAR_ON_EMU = "endchar_on_emu";
	
	String PART_OF_CARD = "part_of_card";
	
	int EPC = 0;
	
	int TID = 1;
	
	/** 0:epc 1:tid */ 
	int DEF_PART_OF_CARD = EPC;

	String DATA_START = "data_sart";
	
	String DATA_LEN= "data_len";
	
	String DEV_BROADCAST = "dev_broadcast";
	
	String DEV_DATAKEY = "dev_datakey";
	
	String DEV_START = "dev_start";
	
	String DEV_STOP = "dev_stop";
	
	String DEV_ADD_ENTER = "dev_add_enter";
	
	// 默认值
	String DEF_BROADCAST = "com.android.server.scannerservice.broadcast";
	String DEF_BROADCAST_ONCE = "com.android.server.scannerservice.broadcast";

	String DEF_KEY = "scannerdata";

	String DEF_START = "com.android.uhf.startscan";

	String DEF_STOP = "com.android.uhf.stopscan";

	String INNER_KEY_DOWN = "com.seek.onKeyDown";
	
	String INNER_KEY_UP = "com.seek.onKeyUp";
	
	boolean DEF_ADD_ENTER = true;

	String FACTORY_TEST_33INV = "factory_test_33inv";
	String FACTORY_TEST_33W = "factory_test_33w";
	String FACTORY_TEST_30W = "factory_test_30w";
	String FACTORY_TEST_27W = "factory_test_27w";


	void initDefValue();

	void load();

	void set(String key, Object value);
}
