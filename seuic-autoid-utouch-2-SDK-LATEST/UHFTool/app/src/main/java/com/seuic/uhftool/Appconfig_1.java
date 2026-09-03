package com.seuic.uhftool;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.LinkedHashMap;

import org.xmlpull.v1.XmlPullParser;
import org.xmlpull.v1.XmlPullParserException;
import org.xmlpull.v1.XmlPullParserFactory;
import org.xmlpull.v1.XmlSerializer;

import android.content.Context;
import android.text.TextUtils;
import android.util.Log;
import android.util.Xml;

public class Appconfig_1 {
	
	private static final String SETTING_FILENAME = "settings_1.xml";

	private static final String DEFAULT_CONFIG_FILENAME = "/system/etc/scanner_appconfig.xml";
	private static String mUserConfigFileName ;
	private static String mDefaultConfigFileName ;

	private static final String LOG_TAG = "Appconfig_1";

	private static Appconfig_1 appconfig ;

	private static Context mContext;
	
	private boolean isplaysound = true;
	private boolean isplayscanled = true;
	private boolean isviberate = false;
	private boolean isclear = false;
	private boolean iscontinue = false;
	private int interval = 1000;
	private boolean isbootstart = true;
	private boolean isAppend = false;
	private boolean isShowType = false;

	private String prefix = "";
	private String suffix = "";
	private boolean isUpToStopScan = true;
	private boolean isOpenScanStatistics = false;
	private boolean isEndCharOnEmu = false;
	private boolean isAddEnterEvent = true;
	private boolean filterInvisibleChars = false;
	private boolean convertInvisibleChars = false;
	private boolean hasCharset = false;
	private boolean filterPrefixSuffixBlank = false;

	private int splitMode = -1;
	private int splitStartIndex = -1;
	private int splitEndIndex = -1;
	private String splitStartChar = "";
	private String splitEndChar = "";
	private boolean showBarcodeToast = false;

	private static LinkedHashMap<String, String> replaceList;

	HashMap<String,Integer> hashMapSI;
	HashMap<Integer, String> hashMapIS;

	public static Appconfig_1 getInstance(Context context){
		if(appconfig == null){
			synchronized (Appconfig_1.class) {
				if(appconfig == null){
					appconfig = new Appconfig_1(context);
				}
			}
		}
		
		return appconfig;
	}
	
	private Appconfig_1(Context context){
		
		init(context);
		
		initSettings();
	}
	
	private void init(Context context){
		
		mContext = context.getApplicationContext();
		
		mUserConfigFileName = mContext.getFilesDir() + "/" + SETTING_FILENAME;
	}
	private void initDefaultSettings(){
		File file = new File(DEFAULT_CONFIG_FILENAME);
		if (file.exists()) {
			loadSettingsFromFile(DEFAULT_CONFIG_FILENAME);
		}else{
			setPrefix("");
			setSuffix("");
			save();
		}
	}
	private void initSettings(){
		File file = new File(DEFAULT_CONFIG_FILENAME);
		if (file.exists()) {
			loadSettingsFromFile(DEFAULT_CONFIG_FILENAME);
		}
		File file1 = new File(mUserConfigFileName);
		if (file1.exists()){
			loadSettingsFromFile(mUserConfigFileName);
		}
	}

	private boolean loadSettingsFromFile(String configFile) {
		boolean isReplace = false;
	    boolean result = false;
	    String tempSource = null;
	    String tempReplace = null;
        try {

            XmlPullParserFactory factory;

            XmlPullParser pullParser;
            try {
                factory = XmlPullParserFactory.newInstance();
                pullParser = factory.newPullParser();
                pullParser.setInput(new FileInputStream(new File(configFile)),
                        null);

                int eventType;
                String configName = null;
                while ((eventType = pullParser.next()) != XmlPullParser.END_DOCUMENT) {
                    switch(eventType){
                        case XmlPullParser.START_TAG:
                            if(pullParser.getAttributeCount() != 0){
                                configName = pullParser.getAttributeValue(0);
                                continue;
                            }
                            if(!TextUtils.isEmpty(configName)){
                                if("PlaySound".equals(configName)){
                                    isplaysound = Integer.parseInt(pullParser.nextText()) != 0;
                                } else if("PlayScanLed".equals(configName)){
                                    isplayscanled = Integer.parseInt(pullParser.nextText()) != 0;
                                } else if("AutoClear".equals(configName)){
                                    isclear = Integer.parseInt(pullParser.nextText()) != 0;
                                }else if("Viberate".equals(configName)){
                                    isviberate = Integer.parseInt(pullParser.nextText()) != 0;
                                }else if("ScanContinue".equals(configName)){
                                    if("param1".equals(pullParser.getName())){
                                    	int i = Integer.parseInt(pullParser.nextText());
                                        iscontinue = i != 0;
                                    }else if("param2".equals(pullParser.getName())){
                                        interval = Integer.parseInt(pullParser.nextText());
                                    }
                                }else if("Bootstart".equals(configName)){
                                    isbootstart = Integer.parseInt(pullParser.nextText()) != 0;
                                }else if("Append".equals(configName)){
                                	if("param2".equals(pullParser.getName())){
                                        suffix = pullParser.nextText();
                                    }else if("param3".equals(pullParser.getName())){
                                        prefix = pullParser.nextText();
                                    }
                                }
                            }
							break;
						case XmlPullParser.END_TAG:
							if(pullParser.getName().equals("config")) {
								configName = null;
							}

							if (pullParser.getName().equals("string")) {
								tempSource = null;
								tempReplace = null;
							}
							break;
					}
				}
                result = true;
            } catch (IOException e) {
                Log.e(LOG_TAG, "getSettings Exception:" + e.getMessage());
            } catch (XmlPullParserException e) {
                Log.e(LOG_TAG, "getSettings Exception:" + e.getMessage());
            }

        } catch (Exception e) {
			Log.e(LOG_TAG, "getSettings Exception e:" + e.getMessage());
        }

        return result;
    }
	
	public void reset(){
		initDefaultSettings();
	}
	
	public boolean isShowType() {
		return isShowType;
	}

	public void setShowType(boolean isShowType) {
		this.isShowType = isShowType;
	}
	
	public String getSuffix() {
		return suffix;
	}

	public void setSuffix(String suffix) {
		this.suffix = suffix;
	}
	
	public String getPrefix(){
		return prefix;
	}
	
	public void setPrefix(String prefix){
		this.prefix = prefix;
	}

	public boolean isAppend() {
		return isAppend;
	}

	public void setAppend(boolean isAppend) {
		this.isAppend = isAppend;
	}
	
	public boolean isContinue() {
		return iscontinue;
	}

	public void setIscontinue(boolean iscontinue) {
		this.iscontinue = iscontinue;
	}

	public boolean isPlaysound() {
		return isplaysound;
	}

	public boolean isPlayscanled() {
		return isplayscanled;
	}

	public void setIsplaysound(boolean isplaysound) {
		this.isplaysound = isplaysound;
	}

	public void setIsplayscanled(boolean isplayscanled) {
		this.isplayscanled = isplayscanled;
	}

	public boolean isViberate() {
		return isviberate;
	}

	public void setIsviberate(boolean isviberate) {
		this.isviberate = isviberate;
	}

	public boolean isClear() {
		return isclear;
	}

	public void setIsclear(boolean isclear) {
		this.isclear = isclear;
	}
	
	public boolean isUpToStopScan(){
		return isUpToStopScan;
	}
	
	public void setUpToStopScan(boolean up){
		this.isUpToStopScan = up;
	}

	public boolean isOpenScanStatistics(){
		return isOpenScanStatistics;
	}

	public void setOpenScanStatistics(boolean isOpen){
		this.isOpenScanStatistics = isOpen;
	}
	
	public void save(){
		saveSettings();
		//ScannerManager.getInstance(mContext).resetProfileIndex();
		//convertProfileItems(replaceStringProfileItemInfos);
	}

	public int getInterval() {
		return interval;
	}

	public void setInterval(int interval) {
		this.interval = interval;
	}
	
	public boolean isEndCharOnEmu(){
		return isEndCharOnEmu;
	}
	
	public void setEndCharOnEmu(boolean onEmu){
		this.isEndCharOnEmu = onEmu;
	}
	
	public boolean isAddEnterEvent(){
		return isAddEnterEvent;
	}
	
	public void setAddEnterEvent(boolean addEnterEvent){
		this.isAddEnterEvent = addEnterEvent;
	}
	
	public boolean isFilterInvisibleChars(){
		return filterInvisibleChars;
	}
	
	public void setFilterInvisibleChars(boolean filter){
		this.filterInvisibleChars = filter;
	}

	public boolean isConvertInvisibleChars(){
		return convertInvisibleChars;
	}

	public void setConvertInvisibleChars(boolean filter){
		this.convertInvisibleChars = filter;
	}

	public boolean isFilterPrefixSuffixBlank(){
		  return filterPrefixSuffixBlank;
	}

	public void setFilterPrefixSuffixBlank(boolean filter){
		this.filterPrefixSuffixBlank = filter;
	}
	
	private void saveSettings(){
			XmlSerializer serializer = null;

			FileOutputStream fos = null;
			try {
				serializer = Xml.newSerializer();

				File file = new File(mUserConfigFileName);

				if (file.exists()) {
					file.delete();
				}

				file.createNewFile();

				fos = new FileOutputStream(file);

				serializer.setOutput(fos, "UTF-8");
				serializer.startDocument("UTF-8", false);

				serializer.startTag(null, "configs");

					// Append Tags
					serializer.startTag(null, "config");
					serializer.attribute(null, "name", "Append");
					serializer.startTag(null, "param2");
					serializer.text(suffix + "");
					serializer.endTag(null, "param2");
					serializer.startTag(null, "param3");
					serializer.text(prefix + "");
					serializer.endTag(null, "param3");

					serializer.endTag(null, "config");


				serializer.endTag(null, "configs");

				serializer.endDocument();

				serializer.flush();

			} catch (FileNotFoundException e) {
				Log.i(LOG_TAG, "generateResultFile:" + e.getMessage());
			} catch (IOException e) {
				Log.i(LOG_TAG, "generateResultFile:" + e.getMessage());
			} finally {
				if (fos != null) {
					try {
						fos.close();
					} catch (IOException e) {
						e.printStackTrace();
					}
				}
			}
		
	}
	
	public boolean isBootstart() {
		return isbootstart;
	}

	public void setBootstart(boolean isbootstart) {
		this.isbootstart = isbootstart;
	}

	public LinkedHashMap<String, String> getReplaceList() {
		return replaceList;
	}

	private static String convertStringToUTF8(String s) {
		if (s == null || s.equals("")) {
			return null;
		}
		StringBuffer sb = new StringBuffer();
		try {
			char c;
			for (int i = 0; i < s.length(); i++) {
				c = s.charAt(i);
				byte[] b;
				b = Character.toString(c).getBytes(StandardCharsets.UTF_8);
				for (int j = 0; j < b.length; j++) {
					int k = b[j];
					k = k < 0? k+256:k;
					sb.append(Integer.toHexString(k).toUpperCase());
				}
			}
		} catch (Exception e) {
			e.printStackTrace();
		}
		return sb.toString();
	}

	public int getSplitStartIndex() {
		return splitStartIndex;
	}

	public void setSplitStartIndex(int splitStartIndex) {
		this.splitStartIndex = splitStartIndex;
	}

	public int getSplitEndIndex() {
		return splitEndIndex;
	}

	public void setSplitEndIndex(int splitEndIndex) {
		this.splitEndIndex = splitEndIndex;
	}

	public boolean isShowBarcodeToast() {
		return showBarcodeToast;
	}

	public void setShowBarcodeToast(boolean showBarcodeToast) {
		this.showBarcodeToast = showBarcodeToast;
	}

	public String getSplitStartChar() {
		return splitStartChar;
	}

	public void setSplitStartChar(String splitStartChar) {
		this.splitStartChar = splitStartChar;
	}

	public String getSplitEndChar() {
		return splitEndChar;
	}

	public void setSplitEndChar(String splitEndChar) {
		this.splitEndChar = splitEndChar;
	}

	public int getSplitMode() {
		return splitMode;
	}

	public void setSplitMode(int splitMode) {
		this.splitMode = splitMode;
	}
}
