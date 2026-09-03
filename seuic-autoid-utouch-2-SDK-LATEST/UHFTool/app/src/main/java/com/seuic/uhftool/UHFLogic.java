package com.seuic.uhftool;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import android.content.Context;
import android.media.AudioManager;
import android.media.SoundPool;
import android.os.Vibrator;

import com.seuic.uhf.EPC;
import com.seuic.uhf.UHFService;
import com.seuic.uhftool.iml.IUHFLogic;
import com.seuic.uhftool.util.BaseUtil;
import com.seuic.uhftool.util.LogUtil;

public class UHFLogic implements IUHFLogic {

    private static final String TAG = "UHFLogic";

    UHFService mService;

    Context mContext;

    private static SoundPool mSoundPool;
    private static Vibrator mVibrator;

    private static int soundID;

    Appconfig mConfig;
    Appconfig_1 mAppconfig_1;

    public UHFLogic(Context context) {
        mContext = context;
        mService = UHFService.getInstance();
        mConfig = Appconfig.getInstance(mContext);
        mAppconfig_1 = Appconfig_1.getInstance(mContext);

        initSoundPool();
    }

    private void initSoundPool() {
        if (mSoundPool == null) {
            mSoundPool = new SoundPool(3, AudioManager.STREAM_MUSIC, 20);
            try {
                soundID = mSoundPool.load(mContext.getAssets().openFd("scan.ogg"), 1);
            } catch (IOException e) {
                e.printStackTrace();
            }
        }
    }

    @Override
    public boolean inventoryOnce(Cache epcUtil) {
        boolean result = false;
        EPC epc = new EPC();
        try {
            synchronized (this) {
                result = mService.inventoryOnce(epc, 60);        //单次寻卡
                //LogUtil.i(TAG, "inventoryOnce result " + result);
            }
        } catch (Exception e) {
            LogUtil.e(TAG, "inventoryOnce", e);
        }
        if (!result) {
            return result;                                    //失败
        }
        //if (epc.getId().isEmpty()) {                            //空标签
        //    return false;
        //}
        playSoundVibrate();                                    //声音、震动
        List<EPC> epcs = new ArrayList<EPC>();
        epcs.add(epc);
        //epcUtil.loadData(epcs);
        epcUtil.getBacks().addAll(epcs);
        epcUtil.loadData_new();
        return result;
    }

    public boolean inventoryOnce_led(Cache epcUtil) {
        boolean result = false;
        EPC epc = new EPC();
        try {
            synchronized (this) {
                result = mService.inventoryOnce(epc, 60);        //单次寻卡
                //LogUtil.i(TAG, "inventoryOnce result " + result);
            }
        } catch (Exception e) {
            LogUtil.e(TAG, "inventoryOnce", e);
        }
        if (!result) {
            return result;                                    //失败
        }
        if (epc.getId().isEmpty()) {                            //如果标签的id为空，失败
            return false;
        }
        String epcid = epc.getId();
        byte[] password = {00, 00, 00, 00};
        mService.readTagLED(BaseUtil.getHexByteArray(epcid), password, 1);

        playSoundVibrate();                                    //声音、震动
        List<EPC> epcs = new ArrayList<EPC>();
        epcs.add(epc);
        //epcUtil.loadData(epcs);
        epcUtil.getBacks().addAll(epcs);
        epcUtil.loadData_new();
        return result;
    }

    public void playSoundVibrate() {
        if (mConfig.vibrate) {
            vibrate();
        }
        if (mConfig.playSound) {
            playSound();
        }
    }

    @Override
    public boolean inventoryStart() {
        //LogUtil.i(TAG, "start inventoryStart");
        boolean result = false;
        try {
            result = mService.inventoryStart();
            //LogUtil.i(TAG, "inventoryStart result " + result);
        } catch (Exception e) {
            LogUtil.e(TAG, "inventoryStart", e);
        }
        return result;
    }

    @Override
    public boolean inventorySelectStart(byte[] epc, int offset, int len) {
        //LogUtil.i(TAG, "start inventorySelectStart");
        boolean result = false;
        try {
            result = mService.inventorySelectStart(epc, offset, len);
            //LogUtil.i(TAG, "inventorySelectStart result " + result);
        } catch (Exception e) {
            LogUtil.e(TAG, "inventorySelectStart", e);
        }
        return result;
    }

    @Override
    public boolean inventoryStop() {
        boolean result = false;
        try {
            result = mService.inventoryStop();
            //LogUtil.i(TAG, "inventoryStop result " + result);

        } catch (Exception e) {
            LogUtil.e(TAG, "inventoryStop", e);
        }
        return result;
    }

    /**
     * 读卡
     *
     * @param epcID
     * @param psw
     * @param bank
     * @param offset
     * @param len
     * @param data
     * @return
     */
    @SuppressWarnings("finally")
    public boolean readTag(String epcID, String psw, String bank, String offset, String len, byte[] data) {

        boolean result = false;
        try {
            if (mService.readTagData(BaseUtil.getHexByteArray(epcID),
                    BaseUtil.getHexByteArray(psw),
                    Integer.parseInt(bank),
                    Integer.parseInt(offset),
                    Integer.parseInt(len), data)) {
                result = true;
            }
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            return result;
        }

    }

    /**
     * 写卡
     *
     * @param epcID
     * @param psw
     * @param bank
     * @param offset
     * @param len
     * @param data
     * @return
     */
    @SuppressWarnings("finally")
    public boolean writeTag(String epcID, String psw, String bank, String offset, String len, String data) {

        byte[] write = new byte[Integer.parseInt(len)];
        String writeData = data.replace(" ", "");
        boolean result = false;
        try {
            BaseUtil.getHexByteArray(writeData, write, Integer.parseInt(len));
            if (mService.writeTagData(BaseUtil.getHexByteArray(epcID),
                    BaseUtil.getHexByteArray(psw),
                    Integer.parseInt(bank),
                    Integer.parseInt(offset),
                    Integer.parseInt(len),
                    write)) {
                result = true;
            }
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            return result;
        }

    }

    public boolean blockWriteTag(String epcID, String psw, String bank, String offset, String len, String data) {
        byte[] write = new byte[Integer.parseInt(len)];
        String writeData = data.replace(" ", "");
        boolean result = false;
        try {
            BaseUtil.getHexByteArray(writeData, write, Integer.parseInt(len));
            if (mService.blockWriteTagData(BaseUtil.getHexByteArray(epcID),
                    BaseUtil.getHexByteArray(psw),
                    Integer.parseInt(bank),
                    Integer.parseInt(offset),
                    Integer.parseInt(len),
                    write)) {
                result = true;
            }
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            return result;
        }
    }
    public boolean blockEraseTag(String epcID, String psw, String bank, String offset, String len) {
        boolean result = false;
        try {
            if (mService.blockEraseTagData(BaseUtil.getHexByteArray(epcID),
                    BaseUtil.getHexByteArray(psw),
                    Integer.parseInt(bank),
                    Integer.parseInt(offset),
                    Integer.parseInt(len))) {
                result = true;
            }
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            return result;
        }
    }
	
	public boolean killTag(String epcID, String psw) {
        boolean result = false;
        try {
            if (mService.killTag(BaseUtil.getHexByteArray(epcID),
                    BaseUtil.getHexByteArray(psw))) {
                result = true;
            }
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            return result;
        }
    }

    public void playSound() {
        initSoundPool();
        mSoundPool.play(soundID, 1, 1, 0, 0, 1);
    }

    public void vibrate() {
        if(mVibrator == null) {
            mVibrator = (Vibrator) mContext.getSystemService(Context.VIBRATOR_SERVICE);
        }
        //long[] pattern = {50, 100};
        //mVibrator.vibrate(pattern, -1);
        mVibrator.vibrate(50);
    }

    public List<EPC> dataToEpclist(String data) {
        if (null == data || data.isEmpty()) {
            return null;
        }
        String intervalChar = "";
        // "ENTER", "TAB", "SPACE"
        switch (mConfig.intervalChar) {
            case 0:
                intervalChar = "\n";
                break;
            case 1:
                intervalChar = "\t";
                break;
            case 2:
                intervalChar = " ";
                break;
            default:
                break;
        }

        List<EPC> epcs = new ArrayList<EPC>();
        String[] datas = data.split(intervalChar);
        for (int i = 0; i < datas.length; i++) {
            EPC epc = new EPC();
            epc.id = BaseUtil.getHexByteArray(datas[i]);
            epc.count = 1;
            epcs.add(epc);
        }

        return epcs;
    }

    /**
     * get new member of epc barcode, playsound and vibrate when got new member
     * and old member's count increase
     *
     * @return
     */
//	public List<EPC> getNoRepetEpc(List<EPC> newList, List<EPC> oldList) {
//		List<EPC> sendList = new ArrayList<EPC>();
//
//		boolean hasNewInventory = false;
//		for(EPC nEpc : newList) {
//			boolean contain = false;
//			for(EPC oEpc : oldList) {
//				if(oEpc.getId().equals(nEpc.getId())) {
//					contain = true;
//					hasNewInventory = !hasNewInventory && (oEpc.count < nEpc.count) ? true : false;
//					break;
//				}
//			}
//			if(!contain) {
//				hasNewInventory = true;
//				sendList.add(nEpc);
//			}
//		}
//		if(hasNewInventory) {
//			playSoundVibrate();
//		}
//		return sendList;
//	}

//	private List<EPC> testGetEPCList() {
//		List<EPC> epcs = new ArrayList<EPC>();
//		for (int i = 0; i < 8; i++) {
//			EPC epc = new EPC();
//			byte[] buffer = new byte[64];
//			BaseUtil.getHexByteArray("10000000000" + i, buffer, 12);
//			epc.id = buffer;
//			epcs.add(epc);
//		}
//		return epcs;
//	}

//	public String getInventoryCtnSendData(List<EPC> epcList) {
//
//		// TODO
////		epcList = testGetEPCList();
//
//		if(epcList == null || epcList.size() == 0) {
//			return null;
//		}
//		StringBuffer sb = new StringBuffer();
//		String intervalChar = "";
//		// "ENTER", "TAB", "SPACE"
//		switch (mConfig.intervalChar) {
//		case 0:
//			intervalChar = "\n";
//			break;
//		case 1:
//			intervalChar = "\t";
//			break;
//		case 2:
//			intervalChar = " ";
//			break;
//		default:
//			break;
//		}
//		for(EPC epc : epcList) {
//			LogUtil.i(TAG, epc.getId());
//			if(sb.length() > 0) {
//				sb.append(intervalChar);
//			}
//			sb.append(addFrefixSuffix(epc.getId()));
//		}
//
//		return sb.toString();
//	}

//	public String getInventoryOnceSendData(EPC epc) {
//		if(epc == null || epc.getId().isEmpty()) {
//			return null;
//		}
//		return addFrefixSuffix(epc.getId());
//	}
    public String addFrefixSuffix(String data, boolean fragFlag) {
        // 前后缀
        StringBuffer sb = new StringBuffer();
        if (!fragFlag) {//在seekFragment中不加前后缀
            sb.append(mAppconfig_1.getPrefix());
            sb.append(data);
            //sb.append(mConfig.suffix);
            sb.append(mAppconfig_1.getSuffix());
        } else {
            sb.append(data);
        }

        //  "ENTER", "TAB", "SPACE", "NONE"
        switch (mConfig.endchar) {
            case 0:
                sb.append("\n");
                break;
            case 1:
                sb.append("\t");
                break;
            case 2:
                sb.append(" ");
                break;
            case 3:
                break;
            default:
                break;
        }

        return sb.toString();
    }

    /**
     *
     *
     * @return
     */
    public String getIntervalChar() {
        String intervalChar = "";
        // "ENTER", "TAB", "SPACE"
        switch (mConfig.intervalChar) {
            case 0:
                intervalChar = "\n";
                break;
            case 1:
                intervalChar = "\t";
                break;
            case 2:
                intervalChar = " ";
                break;
            default:
                break;
        }
        return intervalChar;
    }

    /**
     *
     *
     * @return
     */
    public String getEndChar() {
        String endChar = "";
        // "End symbol" "ENTER", "TAB", "SPACE", "NONE"
        switch (mConfig.endchar) {
            case 0:
                endChar = "\n";
                break;
            case 1:
                endChar = "\t";
                break;
            case 2:
                endChar = " ";
                break;
            case 3:
                break;
            default:
                break;
        }
        return endChar;
    }

    public void outTxt(List<EPC> epclist){
        if(mConfig.export == 1){
            SimpleDateFormat simpleDateFormat = new SimpleDateFormat(
                    "yyyyMMdd_HHmmss");// HH:mm:ss
            // Get the current time
            Date date = new Date(System.currentTimeMillis());

            String fullfilename = mContext.getExternalFilesDir(null).getAbsolutePath()//Environment.getExternalStorageDirectory().getPath()
                    + File.separator+ "tagslist" + simpleDateFormat.format(date) + ".txt";

            File file = new File(fullfilename);
            FileOutputStream fs = null;
            try {
                fs = new FileOutputStream(file);
                String wstr = "Sort, EPC, Count, Rssi, AdditionalData\r\n";
                fs.write(wstr.getBytes());

                int idx=1;
                synchronized (epclist) {//bugid:23672
                    for (EPC item : epclist) {
                        String linestr = String.valueOf(idx++) + ", ";
                        linestr += item.getId() + ", ";
                        if (item.count != 0)
                            linestr += item.count + ", ";
                        else
                            linestr += " ,";
                        if (item.rssi != 0)
                            linestr += item.rssi + ", ";
                        else
                            linestr += " ,";

                        linestr += item.getEmbeded() + ",";

                        linestr += "\r\n";
                        fs.write(linestr.getBytes());
                    }
                }
            } catch (IOException e) {
                // TODO Auto-generated catch block
                e.printStackTrace();
            } finally {
                try {
                    if (fs != null)
                        fs.close();

                } catch (IOException e) {
                    // TODO Auto-generated catch block
                    e.printStackTrace();
                }
            }

        }
    }

}
