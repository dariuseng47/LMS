package com.seuic.uhftool;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import android.content.Context;

import com.seuic.uhf.EPC;
import com.seuic.uhf.UHFService;
import com.seuic.uhftool.iml.ICache;
import com.seuic.uhftool.util.LogUtil;

public class Cache implements ICache {

    private static final String TAG = "Cache";

    private static Cache mCache;
    public static Map<String, EPC> stringEPCMap = new HashMap<>();
    public static Map<String, Integer> localEPCMap = new HashMap<>();
    UHFService mService;

    /**
     *
     */
    private List<EPC> mAllEpcs;


    private List<EPC> mBacks;
    /**
     *
     */
    private List<EPC> mNewEpcs;

    Appconfig mConfig;
    Appconfig_1 mAppconfig_1;

    Context mContext;

    UHFLogic mLogic;
    private int m_NewNum = 0;
    private int m_OldNum = 0;
    private int m_NewNumAll = 0;
    private int m_OldNumAll = 0;

    public List<EPC> getAllEpcs() {
        return mAllEpcs;
    }

    public List<EPC> getBacks() {
        return mBacks;
    }

    public List<EPC> getmNewEpcs() {
        return mNewEpcs;
    }

    public static Cache getInstance(Context context) {
        if (mCache == null) {
            mCache = new Cache(context);
        }
        return mCache;
    }

    private Cache(Context context) {
        mContext = context;
        mConfig = Appconfig.getInstance(mContext);
        mAppconfig_1 = Appconfig_1.getInstance(mContext);
        mLogic = new UHFLogic(mContext);
        mAllEpcs = new ArrayList<EPC>();
        mNewEpcs = new ArrayList<EPC>();
        mService = UHFService.getInstance();
		mBacks = Collections.synchronizedList(new ArrayList<EPC>());
    }

    @Override
    public void clear() {
        mAllEpcs.clear();
        mNewEpcs.clear();
        stringEPCMap.clear();
        localEPCMap.clear();
        mBacks.clear();
        m_NewNum = 0;
        m_OldNum = 0;
        m_NewNumAll = 0;
        m_OldNumAll = 0;
    }

    @Override
    public void loadCache(List<Object> objects) {
    }

    public void loadData_new() {
        //LogUtil.i("TTTTTTTTTTTTT", String.valueOf(mBacks.size()));
        if (mBacks == null) {
            LogUtil.e(TAG, "loadData epcs is null object");
            return;
        }
        mNewEpcs.clear();
        synchronized (mAllEpcs) {
            for (int i=0;i<mBacks.size();i++) {
                EPC epc = mBacks.get(i);
                if(mConfig.tidSort == 0){
                    if (stringEPCMap.get(new String(epc.getId())) != null) {
                        mAllEpcs.get(localEPCMap.get(epc.getId())).count += epc.count;
                        mAllEpcs.get(localEPCMap.get(epc.getId())).rssi = epc.rssi;
                        if (mConfig.isEmbeded) {
                            if (mAllEpcs.get(localEPCMap.get(epc.getId())).getEmbeded().isEmpty() && epc.id[epc.len] > 0) {
                                System.arraycopy(epc.id, epc.len, mAllEpcs.get(localEPCMap.get(epc.getId())).id, epc.len, epc.id[epc.len] + 1);
                            }
                        }
                        m_NewNumAll++;
                        continue;
                    } else {
                        localEPCMap.put(epc.getId(), mAllEpcs.size());
                        stringEPCMap.put(epc.getId(), epc);
                        m_NewNum++;
                    }
                }else {
                    if(epc.getEmbeded().isEmpty())
                        continue;
                    if (stringEPCMap.get(new String(epc.getId() + epc.getEmbeded())) != null) {
                        mAllEpcs.get(localEPCMap.get(epc.getId() + epc.getEmbeded())).count += epc.count;
                        mAllEpcs.get(localEPCMap.get(epc.getId() + epc.getEmbeded())).rssi = epc.rssi;
                        if (mConfig.isEmbeded) {
                            if (mAllEpcs.get(localEPCMap.get(epc.getId() + epc.getEmbeded())).getEmbeded().isEmpty() && epc.id[epc.len] > 0) {
                                System.arraycopy(epc.id, epc.len, mAllEpcs.get(localEPCMap.get(epc.getId() + epc.getEmbeded())).id, epc.len, epc.id[epc.len] + 1);
                            }
                        }
                        m_NewNumAll++;
                        continue;
                    } else {
                        localEPCMap.put(epc.getId() + epc.getEmbeded(), mAllEpcs.size());
                        stringEPCMap.put(epc.getId() + epc.getEmbeded(), epc);
                        m_NewNum++;
                    }
                }
                mAllEpcs.add(epc);
                mNewEpcs.add(epc);
            }
            mBacks.clear();
        }
    }
    public boolean compareNums(){
        boolean ret = false;
        if(m_NewNum > m_OldNum)
            ret = true;
        m_OldNum = m_NewNum;
        return ret;
    }
    public boolean compareNumsAll(){
        boolean ret = false;
        if(m_NewNumAll > m_OldNumAll)
            ret = true;
        m_OldNumAll = m_NewNumAll;
        return ret;
    }

    public void loadData(List<EPC> epcs) {
        if (epcs == null) {
            LogUtil.e(TAG, "loadData epcs is null object");
            return;
        }
        mNewEpcs.clear();
        boolean playSound = false;

        List<EPC> copyAllEpcs = new ArrayList<EPC>();
        synchronized (mAllEpcs) {
            copyAllEpcs.addAll(mAllEpcs);
        }

        if (epcs.size()!=copyAllEpcs.size()){
            isPlaySound(epcs, copyAllEpcs, playSound);
        }else {
            isPlaySound(epcs, playSound);
        }
        synchronized (mAllEpcs) {
            this.mAllEpcs = epcs;
        }
    }

    private boolean isPlaySound(List<EPC> epcs, boolean playSound) {
        int count = 0;
        for (EPC epc : epcs) {
            count += epc.count;
        }
        if (count > m_count) {
            playSound = true;
        }
        m_count = count;
        return playSound;
    }

    static int m_count = 0;

    private boolean isPlaySound(List<EPC> epcs, List<EPC> mAllEpcs, boolean playSound) {

        Map<String, EPC> map = new HashMap<>(mAllEpcs.size());
        for (EPC epc : mAllEpcs) {
            map.put(new String(epc.getId()), epc);
        }
        for (EPC epc : epcs) {
            if (map.get(new String(epc.getId())) != null) {

                continue;
            }
            mNewEpcs.add(epc);
            playsound();
        }
        return playSound;
    }

    public String getBarcode() {
        StringBuffer sb = new StringBuffer();
        List<EPC> copyNewEpcs = new ArrayList<EPC>();
        synchronized (mNewEpcs) {
            copyNewEpcs.addAll(mNewEpcs);
        }
        //if (mConfig.continueSeek) {
            for (EPC epc : copyNewEpcs) {
                if (mConfig.continueSeek) {
                    if (sb.length() > 0) {
                        sb.append(mLogic.getIntervalChar());
                    }
                }
                String fixedBarcode;
                if (mConfig.dataLen != 0) {
                    String id = epc.getId();
                    if (id.length() >= (mConfig.dataStart + mConfig.dataLen))
                        fixedBarcode = getFixBarcode(id.substring(mConfig.dataStart, (mConfig.dataStart + mConfig.dataLen)));
                    else
                        fixedBarcode = getFixBarcode(epc.getId());
                } else {
                    fixedBarcode = getFixBarcode(epc.getId());
                }
                if (null != fixedBarcode) {
                    sb.append(fixedBarcode);
                }
            }
        //}
        // TODO
        if ((sb.length() > 0) && (Appconfig.SENDMODE_FOCUS != mConfig.sendmode || !mConfig.endcharOnEmu)) {
            sb.append(mLogic.getEndChar());
        }
        return sb.toString();
    }

    /***
     *
     * @param barcode
     * @return
     */
    public String getFixBarcode(String barcode) {
        if (null == barcode || barcode.isEmpty()) {
            return null;
        }
        StringBuffer sb = new StringBuffer();
        sb.append(mAppconfig_1.getPrefix());
        sb.append(barcode);
        sb.append(mAppconfig_1.getSuffix());
        return sb.toString();
    }

    public void playsound(){
        mLogic.playSoundVibrate();
    }

}
