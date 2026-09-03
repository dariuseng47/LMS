package com.seuic.uhftool.activity;

import static java.lang.Thread.sleep;

import java.util.ArrayList;
import java.util.List;

import android.annotation.SuppressLint;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Message;
import android.os.SystemClock;
import android.support.v4.app.Fragment;
import android.text.Editable;
import android.text.Spannable;
import android.text.SpannableStringBuilder;
import android.text.TextUtils;
import android.text.TextWatcher;
import android.text.style.ForegroundColorSpan;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.View.OnClickListener;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.AdapterView;
import android.widget.AdapterView.OnItemClickListener;
import android.widget.ArrayAdapter;
import android.widget.BaseAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.CompoundButton;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import com.seuic.uhf.EPC;
import com.seuic.uhf.UHFService;
import com.seuic.uhftool.AppCache;
import com.seuic.uhftool.Appconfig;
import com.seuic.uhftool.BarcodeConfig;
import com.seuic.uhftool.util.BaseUtil;
import com.seuic.uhftool.Cache;
import com.seuic.uhftool.util.DisplayUtil;
import com.seuic.uhftool.iml.IFragment;
import com.seuic.uhftool.util.LogUtil;
import com.seuic.uhftool.MyAdapter;
import com.seuic.uhftool.R;
import com.seuic.uhftool.util.ServiceUtil;
import com.seuic.uhftool.StateVO;
import com.seuic.uhftool.UHFLogic;
import com.seuic.uhftool.service.UhfService;

import org.greenrobot.eventbus.EventBus;
import org.greenrobot.eventbus.Subscribe;
import org.greenrobot.eventbus.ThreadMode;

public class SeekFragment extends Fragment implements IFragment,
        OnClickListener {

    private static final String TAG = "SeekFragment";
    public static volatile boolean isstart = false;
    public static volatile boolean mInvModeValid = true;
    private LEDReadThread ledthread;
    private KLWReadThread klwthread;
    View mCurrentView;

    UHFLogic mUHFLogic;

    Context mContext;

    UHFService mService;

    List<EPC> mEPCList;

    Appconfig mConfig;

    BarcodeConfig mBarcodeConfig;

    static EPCAdapter mAdapter;

    int mSelectIndex = -1;

    String[] mBankChooses;

    public boolean mInventoryStart = false;

    public boolean mIsContinue = true;

    long statenvtick;

    UHFLogic mLogic;

    Cache mEPCUtil;

    long m_speednum = 0;

    private long m_time = 0;

    private long m_timenow = 0;

    byte[] password_0 = {00, 00, 00, 00};

    private int mFilterMatch = 0;
    private int arrFilter_bank;

    private ArrayAdapter<String> pow_select_adapter;

    private ArrayAdapter<String> invmode_adapter;

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        Log.d(TAG, "onCreateView: new View");
        mCurrentView = inflater.inflate(R.layout.fragment_seek, null);
        mContext = mCurrentView.getContext();
        mUHFLogic = new UHFLogic(mContext);
        mConfig = Appconfig.getInstance(mContext);
        mBarcodeConfig = BarcodeConfig.getInstance(mContext);
        mBankChooses = mContext.getResources().getStringArray(R.array.msg_bank_choose);
        mLogic = new UHFLogic(mContext);
        mEPCUtil = Cache.getInstance(mContext);
        AppCache.setMainShown(true);
        if(!UhfService.uhfserver_isStart)
            mHandler.sendEmptyMessage(START_SERVICE);
        return mCurrentView;
    }

    @Override
    public void onActivityCreated(Bundle savedInstanceState) {
        super.onActivityCreated(savedInstanceState);
        mEPCList = mEPCUtil.getAllEpcs();
        initView();
    }

    @Override
    public void onSaveInstanceState(Bundle outState) {
    }

    UHFDataReciever mDataReciever;
    MyReceiver myReceiver;

    @Override
    public void onResume() {
        if (myReceiver == null) {
            myReceiver = new MyReceiver();
        }
        IntentFilter startOrStopFilter = new IntentFilter();
        startOrStopFilter.addAction("com.seuic.uhftool.service.start");
        startOrStopFilter.addAction("com.seuic.uhftool.service.stop");
        startOrStopFilter.addAction("com.seuic.uhftool.service.ledstart");
        startOrStopFilter.addAction("com.seuic.uhftool.service.ledstop");
        startOrStopFilter.addAction("com.seuic.uhftool.service.buttonstop");
        mContext.registerReceiver(myReceiver, startOrStopFilter);
        try {
            if (mService == null) {
                mService = UHFService.getInstance();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        if(!mService.isOpen() && mConfig.isSpecial) {
            Log.d(TAG, "isOpen false");
            mService.open();
        }
        if (UhfService.mInventoryStart)
            inventoryStop();
        UhfService.mInventoryStart = false;
        if(mConfig.continueTime){
            sp_invmode.setSelection(2);
            mIsContinue = true;
        }else {
            if (!mConfig.continueSeek) {
                sp_invmode.setSelection(1);
                mIsContinue = false;
            } else {
                sp_invmode.setSelection(0);
                mIsContinue = true;
            }
        }
        mSeek_continue_bt.setEnabled(true);
        mSeek_continue_bt.setText(mContext.getResources().getString(R.string.msg_continue_seek));

        AppCache.setMainShown(true);
        AppCache.setSetting(0);
        refresh();

        if (mDataReciever == null) {
            mDataReciever = new UHFDataReciever();
        }
        IntentFilter uhfDataFilter = new IntentFilter();
        uhfDataFilter.addAction(mConfig.devBroadcast);
        mContext.registerReceiver(mDataReciever, uhfDataFilter);
        try {
            if (mConfig.isFilter) {
                cb_filter.setChecked(true);
            }
            if (mConfig.isSpecial) {
                cn_special.setChecked(true);
                setSpecialFilter();
            }
            if (mConfig.moduleType == 0) {
                String version = mService.getFirmwareVersion();
                if (version != null) {
                    if (version.equals("2.6.0.240"))
                        mConfig.set("moduleType", 1);
                    else
                        mConfig.set("moduleType", 2);
                }
            }
        } catch (Exception e) {
            System.exit(0);
            e.printStackTrace();
        }
        if (mConfig.moduleType == 1) {
            cn_special.setVisibility(View.GONE);
        }
        super.onResume();
    }

    @Override
    public void onPause() {
        AppCache.setMainShown(false);
        if (mService == null) {
            mService = UHFService.getInstance();
        }
        if (mInventoryStart) {
            UhfService.mInventoryStart = false;
            mInventoryStart = false;
            mSeek_continue_bt.setEnabled(true);
            checkStatus();
            inventoryStop();
        }
        if(isstart) {
            isstart = false;
            inventoryLedStop();
        }
        mContext.unregisterReceiver(mDataReciever);
        mDataReciever = null;
        mContext.unregisterReceiver(myReceiver);
        myReceiver = null;
        getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        super.onPause();
    }

    public void onDestroy() {
        if (mConfig.isFilter) {
            mService.setParamBytes(UHFService.PARAMETER_TAG_FILTER, null);
        }
        super.onDestroy();
        if(AppCache.mRestartFragment != null) {
            new Handler().post(AppCache.mRestartFragment);
        }
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        refresh_UI();
    }

    public void refresh_UI() {
        mClearEPC.setText(mContext.getResources().getString(R.string.clear));
        mSeek_continue_bt.setText(mContext.getResources().getString(R.string.msg_continue_seek));
        cb_filter.setText(mContext.getResources().getString(R.string.filter));
        tv_filter_bank.setText(mContext.getResources().getString(R.string.filter_bank));
        tv_filter_data.setText(mContext.getResources().getString(R.string.filter_data));
        tv_filter_len.setText(mContext.getResources().getString(R.string.msg_lengh));
        tv_filter_offset.setText(mContext.getResources().getString(R.string.msg_address));
        rb_filter_match.setText(mContext.getResources().getString(R.string.filter_match));
        rb_filter_mismatch.setText(mContext.getResources().getString(R.string.filter_mismatch));
        btn_filter_ok.setText(mContext.getResources().getString(R.string.msg_confirm));

        tv_time_v.setText(mContext.getResources().getString(R.string.time));
        tv_tagnums_v.setText(mContext.getResources().getString(R.string.tag_num));
        tv_totalnums_v.setText(mContext.getResources().getString(R.string.tag_total));

        cn_special.setText(mContext.getResources().getString(R.string.special_filter));
        tv_choose_power.setText(mContext.getResources().getString(R.string.choose_power));
        tv_choose_factory.setText(mContext.getResources().getString(R.string.choose_factory));
        tv_select_epc.setText(mContext.getResources().getString(R.string.epc));
        pow_text.setText(mContext.getResources().getString(R.string.select_text_temperature));

        pow_func.setText(mContext.getResources().getString(R.string.tem_get_tem));

        tv_sequence.setText(mContext.getResources().getString(R.string.msg_sequence));
        tv_epc_id.setText(mContext.getResources().getString(R.string.msg_epc_id));
        tv_nums.setText(mContext.getResources().getString(R.string.msg_nums));
        tv_add_data.setText(mContext.getResources().getString(R.string.add_data));

        tv_invtime.setText(mContext.getResources().getString(R.string.working_time));
        tv_speed_name.setText(mContext.getResources().getString(R.string.speed));
        tv_speed_unit.setText(mContext.getResources().getString(R.string.speed_unit));

        set_Adapter();
    }

    @Override
    public void refresh() {
        mAdapter.setList();
        if(mConfig.isSpecial) {
            synchronized (mAdapter.mList) {
                data_list.clear();
                listVOs.clear();
                listVOs.add(new StateVO(mContext.getResources().getString(R.string.multiple_choice), false));
                for (EPC epc : mAdapter.mList) {
                    data_list.add(epc.getId());
                    StateVO stateVO = new StateVO();
                    stateVO.setTitle(epc.getId());
                    stateVO.setSelected(false);
                    listVOs.add(stateVO);
                }
                arr_adapter.setDropDownViewResource(R.layout.epc_spinner_item);
                if (pow_select.getSelectedItemPosition() == 0) {
                    ecp_select.setAdapter(arr_adapter);
                } else {
                    ecp_select.setAdapter(myAdapter);
                }
                arr_adapter.notifyDataSetChanged();
                myAdapter.notifyDataSetChanged();
            }
        }
        mAdapter.notifyDataSetChanged();
        checkStatus();
    }

    @Override
    public void getview() {
    }

    @Subscribe
            (threadMode = ThreadMode.MAIN)
    public void onMessageEvent(String msg) {
        if (msg.equals("keyDown")) {
            Log.e(TAG, "onMessageEvent: KeyDown");
            if (mInventoryStart) {
                mSeek_continue_bt.performClick();
            }
        }
    }

    @Override
    public void onClick(View v) {
        switch (v.getId()) {
            case R.id.btn_clear_epc:
                mAdapter.mList.clear();
                mAdapter.notifyDataSetChanged();
                tv_tagnums.setText("");
                tv_totalnums.setText("");
                pow_value.setText("");
                tv_speed.setText("");
                data_list.clear();
                arr_adapter.notifyDataSetChanged();
                if (cn_special.isChecked())
                    listVOs.clear();
                mService.setParameters(UHFService.PARAMETER_CLEAR_EPCLIST, 1);
                tv_time.setText("");
                mEPCUtil.clear();
                if (mEPCList != null) {
                    mEPCList.clear();
                }
                m_time = 0;
                m_speednum = 0;
                m_timenow = 0;
                break;

            case R.id.btn_seek_continue:
                if (cn_special.isChecked() && isYiLianLed()) {
                    setSpecialFilter();
                    if (!isstart) {
                        mSeek_continue_bt.setText(mContext.getResources().getString(R.string.msg_stop));
                        clearEPCList();
                        cb_filter.setEnabled(false);
                        cn_special.setEnabled(false);
                        mClearEPC.setEnabled(false);
                        btn_filter_ok.setEnabled(false);
                        pow_func.setEnabled(false);
                        factory_select.setEnabled(false);
                        pow_select.setEnabled(false);
                        tv_time.setText("");
                        statenvtick = SystemClock.elapsedRealtime();
                        doLedThread();

                        break;
                    } else {
                        mSeek_continue_bt.setText(mContext.getResources().getString(R.string.msg_continue_seek));
                        doStopLedThread();
                        factory_select.setEnabled(true);
                        pow_select.setEnabled(true);
                        cb_filter.setEnabled(true);
                        cn_special.setEnabled(true);
                        mClearEPC.setEnabled(true);
                        btn_filter_ok.setEnabled(true);
                        pow_func.setEnabled(true);
                        mUHFLogic.outTxt(mEPCList);
                        break;
                    }
                } else {
                    if (!mIsContinue) {

                        mSeek_continue_bt.setEnabled(false);
                        AppCache.setScanEnable(false);
                        inventoryOnce();
                        mSeek_continue_bt.setEnabled(true);
                        AppCache.setScanEnable(true);

                        break;
                    } else {
                        if (!mInventoryStart) {
                            if (!EventBus.getDefault().isRegistered(this)) {
                                EventBus.getDefault().register(this);
                            }
                            if (inventoryStart()) {
                                getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                                sp_invmode.setEnabled(false);
                                et_invtime.setEnabled(false);
                                factory_select.setEnabled(false);
                                pow_select.setEnabled(false);
                                cb_filter.setEnabled(false);
                                cn_special.setEnabled(false);
                                mClearEPC.setEnabled(false);
                                btn_filter_ok.setEnabled(false);
                                pow_func.setEnabled(false);
                                AppCache.setScanEnable(false);
                                tv_time.setText("");
                                statenvtick = SystemClock.elapsedRealtime();
                            }
                        } else {
                            inventoryStop();
                            AppCache.setScanEnable(true);
                        }
                    }
                }
                refresh();
                break;

            case R.id.rb_filter_match:
                mFilterMatch = 0;
                break;

            case R.id.rb_filter_mismatch:
                mFilterMatch = 1;
                break;

            case R.id.btn_filter_ok:
                if (!setFilter())
                    break;
                Toast.makeText(mContext, mContext.getResources().getString(R.string.set_success), Toast.LENGTH_SHORT).show();
                break;
            case R.id.pow_func:
                int factory_it = factory_select.getSelectedItemPosition();
                byte[] password = {00, 00, 00, 00};
                if (pow_select.getSelectedItemPosition() == 0) {
                    if (ecp_select.getSelectedItem() != null) {
                        double cantemp = -100;
                        String epcid = ecp_select.getSelectedItem().toString();
                        if (factory_it == 0) {
                            cantemp = mService.readTagTemperature(BaseUtil.getHexByteArray(epcid), password, 1);
                        } else if (factory_it == 1) {
                            cantemp = mService.readTagTemperature(BaseUtil.getHexByteArray(epcid), password, 2);
                            mConfig.set("isEmbeded", false);
                        } else if (factory_it == 2) {
                            cantemp = mService.readTagTemperature(BaseUtil.getHexByteArray(epcid), password, 3);
                        } else if (factory_it == 3) {
                            cantemp = mService.readTagTemperature(BaseUtil.getHexByteArray(epcid), password, 4);
                        } else if (factory_it == 4) {
                            cantemp = mService.readTagTemperature(BaseUtil.getHexByteArray(epcid), password, 5);
                        }else if (factory_it == 5) {
                            cantemp = mService.readTagTemperature(BaseUtil.getHexByteArray(epcid), password, 6);
                        }else if (factory_it == 6) {
                            cantemp = mService.readTagTemperature(BaseUtil.getHexByteArray(epcid), password, 8);
                        }
                        pow_value.setText(cantemp != -100.0d ? cantemp + "" : "fail");
                        setSpecialFilter();
                    }
                } else {
                    int ledtotal = 0;
                    if (!isstart) {
                        mSeek_continue_bt.setEnabled(false);
                        factory_select.setEnabled(false);
                        pow_select.setEnabled(false);
                        cb_filter.setEnabled(false);
                        cn_special.setEnabled(false);
                        mClearEPC.setEnabled(false);
                        btn_filter_ok.setEnabled(false);
                        mClearEPC.setEnabled(false);
                        pow_func.setText(getResources().getString(R.string.tem_get_lec_stop));
                        AppCache.setScanEnable(false);
                        doKLWThread();
                        for (int i = 1; i < listVOs.size(); i++) {
                            if (listVOs.get(i).isSelected()) {
                                ledtotal++;
                            }
                        }
                        pow_value.setText(ledtotal + "");
                    } else {
                        inventoryLedStop();
                    }
                }
                break;
            default:
                break;
        }

    }

    public void clearEPCList() {
        if (mBarcodeConfig.getValue("PARAMETER_CLEAR_EPCLIST_WHEN_START_INVENTORY", 1) == 1) {
            mAdapter.mList.clear();
            mAdapter.notifyDataSetChanged();
            mEPCUtil.clear();
            mSelectIndex = -1;
            m_speednum = 0;
            if (mEPCList != null) {
                mEPCList.clear();
            }
        }
        m_timenow = 0;
        m_time = 0;
    }

    InventoryThread mThread;
    SoundThread soundThread;

    private void inventoryOnce() {
        if (mConfig.isFilter && cb_filter.isChecked() && mConfig.moduleType == 2) {
            setFilter_run();
        }

        clearEPCList();
        mUHFLogic.inventoryOnce(mEPCUtil);
        mHandler.sendEmptyMessage(ONCE);
    }

    private boolean setFilter() {
        if ((TextUtils.isEmpty(et_filter_offset.getText())) || (TextUtils.isEmpty(et_filter_len.getText()))
                || (TextUtils.isEmpty(et_filter_data.getText()))) {
            Toast.makeText(mContext, mContext.getResources().getString(R.string.value_cannot_empty), Toast.LENGTH_SHORT).show();
            return false;
        }

        byte[] val = new byte[255];
        val[0] = (byte) (sp_filter_bank.getSelectedItemPosition() + 1);
        val[1] = (byte) Integer.parseInt(et_filter_offset.getText().toString());
        val[2] = (byte) Integer.parseInt(et_filter_len.getText().toString());
        val[3] = (byte) mFilterMatch;
        byte[] data = BaseUtil.getHexByteArray(et_filter_data.getText().toString());
        if (val[2] != data.length) {
            Toast.makeText(mContext, mContext.getResources().getString(R.string.parameterisnot_correct), Toast.LENGTH_SHORT).show();
            return false;
        }
        System.arraycopy(data, 0, val, 4, val[2]);
        mService.setParamBytes(UHFService.PARAMETER_TAG_FILTER, val);

        mConfig.set("filterBank", sp_filter_bank.getSelectedItemPosition() + 1);
        mConfig.set("filterAddress", Integer.parseInt(et_filter_offset.getText().toString()));
        mConfig.set("filterLenth", Integer.parseInt(et_filter_len.getText().toString()));
        mConfig.set("filterMatch", mFilterMatch);
        mConfig.set("filterString", et_filter_data.getText().toString());
        mConfig.isFilter = true;

        return true;
    }

    private boolean setFilter_run() {
        byte[] val = new byte[255];
        val[0] = (byte) mConfig.filterBank;
        val[1] = (byte) mConfig.filterAddress;
        val[2] = (byte) mConfig.filterLenth;
        val[3] = (byte) mConfig.filterMatch;
        byte[] data = BaseUtil.getHexByteArray(mConfig.filterString);
        if ((data == null)) {
            return false;
        } else {
            if ((val[2] != data.length)) {
                return false;
            }
            System.arraycopy(data, 0, val, 4, val[2]);
            mService.setParamBytes(UHFService.PARAMETER_TAG_FILTER, val);
        }
        return true;
    }

    /**
     * @Description:
     */
    public void setSpecialFilter() {
        String factory = factory_select.getSelectedItem().toString();
        LogUtil.d(TAG, "setSpecialFilter factory="+factory);
        if ("B5020M1-T1E".equals(factory) || "ET-C2ES".equals(factory) ) {
            byte[] val = new byte[255];
            val[0] = (byte) (2);
            val[1] = (byte) (0);
            val[2] = (byte) (3);
            byte[] data = BaseUtil.getHexByteArray("e201e2");
            System.arraycopy(data, 0, val, 4, val[2]);
            mService.setParamBytes(UHFService.PARAMETER_TAG_FILTER, val);
            mService.setParamBytes(UHFService.PARAMETER_TAG_EMBEDEDDATA, null);
            mService.setParameters(UHFService.PARAMETER_INVENTORY_SESSION, mBarcodeConfig.getValue("PARAMETER_INVENTORY_SESSION", 1));//S1
            mService.setParameters(UHFService.PARAMETER_INVENTORY_SESSION_TARGET, mBarcodeConfig.getValue("PARAMETER_INVENTORY_SESSION_TARGET", 0));//A
        } else if ("KX2005X-BL".equals(factory)) {
            byte[] val = new byte[255];
            val[0] = (byte) (2);
            val[1] = (byte) (0);
            val[2] = (byte) (3);
            byte[] data = BaseUtil.getHexByteArray("e281d0");//e201d2 //e281d0
            System.arraycopy(data, 0, val, 4, val[2]);
            mService.setParamBytes(UHFService.PARAMETER_TAG_FILTER, val);
            val[0] = (byte) (0);
            val[1] = (byte) (8);
            val[2] = (byte) (2);
            data = BaseUtil.getHexByteArray("00000000");
            System.arraycopy(data, 0, val, 3, 4);
            mService.setParamBytes(UHFService.PARAMETER_TAG_EMBEDEDDATA, val);
            mService.setParameters(UHFService.PARAMETER_INVENTORY_SESSION, mBarcodeConfig.getValue("PARAMETER_INVENTORY_SESSION", 1));
            mService.setParameters(UHFService.PARAMETER_INVENTORY_SESSION_TARGET, mBarcodeConfig.getValue("PARAMETER_INVENTORY_SESSION_TARGET", 0));//A
        } else if ("LTU32".equals(factory)) {
            byte[] val = new byte[255];
            val[0] = (byte) (2);
            val[1] = (byte) (0);
            val[2] = (byte) (4);
            byte[] data = BaseUtil.getHexByteArray("e2035101");//E2035101 //e20351010500
            System.arraycopy(data, 0, val, 4, val[2]);
            mService.setParamBytes(UHFService.PARAMETER_TAG_FILTER, val);
            mService.setParameters(UHFService.PARAMETER_INVENTORY_SESSION, mBarcodeConfig.getValue("PARAMETER_INVENTORY_SESSION", 1));//S1
            mService.setParameters(UHFService.PARAMETER_INVENTORY_SESSION_TARGET, 1);//B
            mService.setParamBytes(UHFService.PARAMETER_TAG_EMBEDEDDATA, null);
        } else if ("N2ESL".equals(factory)) {
            byte[] val = new byte[255];
            val[0] = (byte) (2);
            val[1] = (byte) (0);
            val[2] = (byte) (3);
            byte[] data = BaseUtil.getHexByteArray("e201e2");
            System.arraycopy(data, 0, val, 4, val[2]);
            mService.setParamBytes(UHFService.PARAMETER_TAG_FILTER, val);
            val[0] = (byte) (3);
            val[1] = (byte) (224);
            val[2] = (byte) (2);
            data = BaseUtil.getHexByteArray("00000000");
            System.arraycopy(data, 0, val, 3, 4);
            mService.setParamBytes(UHFService.PARAMETER_TAG_EMBEDEDDATA, val);
            mService.setParameters(UHFService.PARAMETER_INVENTORY_SESSION, mBarcodeConfig.getValue("PARAMETER_INVENTORY_SESSION", 1));
            mService.setParameters(UHFService.PARAMETER_INVENTORY_SESSION_TARGET, mBarcodeConfig.getValue("PARAMETER_INVENTORY_SESSION_TARGET", 0));//A
        }else if ("NMV2D".equals(factory)) {
            byte[] val = new byte[255];
            val[0] = (byte) (2);
            val[1] = (byte) (0);
            val[2] = (byte) (4);
            byte[] data = BaseUtil.getHexByteArray("E2C19CB1");
            System.arraycopy(data, 0, val, 4, val[2]);
            mService.setParamBytes(UHFService.PARAMETER_TAG_FILTER, val);
            mService.setParameters(UHFService.PARAMETER_INVENTORY_SESSION, mBarcodeConfig.getValue("PARAMETER_INVENTORY_SESSION", 1));//S1
            mService.setParameters(UHFService.PARAMETER_INVENTORY_SESSION_TARGET, mBarcodeConfig.getValue("PARAMETER_INVENTORY_SESSION_TARGET", 0));//A
            mService.setParamBytes(UHFService.PARAMETER_TAG_EMBEDEDDATA, null);
        }else if ("M3D".equals(factory)) {
            byte[] val = new byte[255];
            val[0] = (byte) (2);
            val[1] = (byte) (0);
            val[2] = (byte) (3);
            byte[] data = BaseUtil.getHexByteArray("E28240");
            System.arraycopy(data, 0, val, 4, val[2]);
            mService.setParamBytes(UHFService.PARAMETER_TAG_FILTER, val);
            mService.setParameters(UHFService.PARAMETER_INVENTORY_SESSION, mBarcodeConfig.getValue("PARAMETER_INVENTORY_SESSION", 1));//S1
            mService.setParameters(UHFService.PARAMETER_INVENTORY_SESSION_TARGET, mBarcodeConfig.getValue("PARAMETER_INVENTORY_SESSION_TARGET", 0));//A
            mService.setParamBytes(UHFService.PARAMETER_TAG_EMBEDEDDATA, null);
        }else if ("ET-C2ESL".equals(factory)) {
            byte[] val = new byte[255];
            val[0] = (byte) (2);
            val[1] = (byte) (0);
            val[2] = (byte) (3);
            byte[] data = BaseUtil.getHexByteArray("ffffff");
            System.arraycopy(data, 0, val, 4, val[2]);
            mService.setParamBytes(UHFService.PARAMETER_TAG_FILTER, val);
            mService.setParamBytes(UHFService.PARAMETER_TAG_EMBEDEDDATA, null);
            mService.setParameters(UHFService.PARAMETER_INVENTORY_SESSION, mBarcodeConfig.getValue("PARAMETER_INVENTORY_SESSION", 1));//S1
            mService.setParameters(UHFService.PARAMETER_INVENTORY_SESSION_TARGET, mBarcodeConfig.getValue("PARAMETER_INVENTORY_SESSION_TARGET", 0));//A
        }else if ("VBL".equals(factory)) {
            byte[] val = new byte[255];
            val[0] = (byte) (2);
            val[1] = (byte) (0);
            val[2] = (byte) (3);
            byte[] data = BaseUtil.getHexByteArray("e2c19c");
            System.arraycopy(data, 0, val, 4, val[2]);
            mService.setParamBytes(UHFService.PARAMETER_TAG_FILTER, val);
            val[0] = (byte) (0);
            val[1] = (byte) (10);
            val[2] = (byte) (2);
            data = BaseUtil.getHexByteArray("00000000");
            System.arraycopy(data, 0, val, 3, 4);
            mService.setParamBytes(UHFService.PARAMETER_TAG_EMBEDEDDATA, val);
            mService.setParameters(UHFService.PARAMETER_INVENTORY_SESSION, mBarcodeConfig.getValue("PARAMETER_INVENTORY_SESSION", 1));
            mService.setParameters(UHFService.PARAMETER_INVENTORY_SESSION_TARGET, mBarcodeConfig.getValue("PARAMETER_INVENTORY_SESSION_TARGET", 0));//A
        }else if ("HX03".equals(factory)) {
            byte[] val = new byte[255];
            val[0] = (byte) (2);
            val[1] = (byte) (0);
            val[2] = (byte) (3);
            byte[] data = BaseUtil.getHexByteArray("E200FF");
            System.arraycopy(data, 0, val, 4, val[2]);
            mService.setParamBytes(UHFService.PARAMETER_TAG_FILTER, val);
            mService.setParameters(UHFService.PARAMETER_INVENTORY_SESSION, mBarcodeConfig.getValue("PARAMETER_INVENTORY_SESSION", 1));//S1
            mService.setParameters(UHFService.PARAMETER_INVENTORY_SESSION_TARGET, mBarcodeConfig.getValue("PARAMETER_INVENTORY_SESSION_TARGET", 0));//A
            mService.setParamBytes(UHFService.PARAMETER_TAG_EMBEDEDDATA, null);
        }
    }

    private boolean inventoryStart() {
        if (Appconfig.TID == mConfig.partOfCard) {
            Toast.makeText(mContext, mContext.getResources().getString(R.string.msg_tid_notsurpport), Toast.LENGTH_SHORT).show();
        }
        if(sp_invmode.getSelectedItemPosition() == 2) {
            if (!mInvModeValid) {
                Toast.makeText(mContext, mContext.getResources().getString(R.string.working_time_int), Toast.LENGTH_SHORT).show();
                return false;
            }
        }

        clearEPCList();
        boolean inventory = false;
        if (mConfig.isFilter && cb_filter.isChecked() && mConfig.moduleType == 1) {
            if (!mConfig.filterString.isEmpty()) {
                byte[] con = BaseUtil.getHexByteArray(mConfig.filterString);
                inventory = mService.inventorySelectStart(con, mConfig.filterAddress, mConfig.filterLenth);
            } else
                inventory = mService.inventoryStart();
        } else {
            if (mConfig.isFilter && cb_filter.isChecked()) {
                setFilter_run();
            }
            if (cn_special.isChecked())
                setSpecialFilter();
            inventory = mService.inventoryStart();
        }
        if (inventory) {
            doStartThread();
        }
        return inventory;
    }

    private boolean inventoryStop() {
        getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (!mService.inventoryStop()) {
            return false;
        }
        UhfService.mInventoryStart = false;
        mInventoryStart = false;
        if (EventBus.getDefault().isRegistered(this)) {
            EventBus.getDefault().unregister(this);
        }
        if (cn_special.isChecked()) {
            sp_invmode.setEnabled(false);
        } else {
            sp_invmode.setEnabled(true);
            et_invtime.setEnabled(true);
        }
        mSeek_continue_bt.setEnabled(true);
        cb_filter.setEnabled(true);
        cn_special.setEnabled(true);
        mClearEPC.setEnabled(true);
        factory_select.setEnabled(true);
        pow_select.setEnabled(true);
        btn_filter_ok.setEnabled(true);
        pow_func.setEnabled(true);
        doStopThread();
        mUHFLogic.outTxt(mEPCList);

        return true;
    }

    public boolean inventoryLedStop() {
        doStopKLWThread();
        mSeek_continue_bt.setEnabled(true);
        factory_select.setEnabled(true);
        pow_select.setEnabled(true);
        cb_filter.setEnabled(true);
        cn_special.setEnabled(true);
        mClearEPC.setEnabled(true);
        btn_filter_ok.setEnabled(true);
        mClearEPC.setEnabled(true);
        pow_func.setText(getResources().getString(R.string.tem_get_lec));
        AppCache.setScanEnable(true);
        setSpecialFilter();
        return true;
    }

    private final int INVENTORY = 100;
    private final int ONCE = 200;
    private final int LED_ONCE = 300;
    private final int FILTER = 400;
    private final int START_SERVICE = 123;

    @SuppressLint("HandlerLeak")
    Handler mHandler = new Handler() {
        @Override
        public void handleMessage(Message msg) {
            switch (msg.what) {
                case INVENTORY:
                    mEPCList = mEPCUtil.getAllEpcs();
                    if (mInventoryStart) {
                        refresh();
                        m_time = SystemClock.elapsedRealtime() - statenvtick;
                        tv_time.setText(String.valueOf(m_time));
                    }
                    if(sp_invmode.getSelectedItemPosition() == 2){
                        if(m_time>=Integer.parseInt(et_invtime.getText().toString())*1000){
                            inventoryStop();
                            m_time = Integer.parseInt(et_invtime.getText().toString())*1000;
                            AppCache.setScanEnable(true);
                            refresh();
                        }
                    }
                    break;
                case ONCE:
                    mEPCList = mEPCUtil.getAllEpcs();
                    if(mEPCList.size() == 0){
                        mAdapter.mList.clear();
                    }
                    m_time = 0;
                    tv_time.setText(String.valueOf(m_time));
                    tv_speed.setText("");
                    refresh();
                    break;
                case START_SERVICE:
                    ServiceUtil mServiceUtil = ServiceUtil.getSingleStance();
                    mServiceUtil.start(mContext.getApplicationContext(), UhfService.class);
                    break;
                case LED_ONCE:
                    refresh();
                    break;
                case FILTER:
                    sp_filter_bank.setSelection(mConfig.filterBank - 1);
                    et_filter_offset.setText(String.valueOf(mConfig.filterAddress));
                    et_filter_len.setText(String.valueOf(mConfig.filterLenth));
                    if (mConfig.filterMatch == 0)
                        rb_filter_match.setChecked(true);
                    else
                        rb_filter_mismatch.setChecked(true);
                    et_filter_data.setText(mConfig.filterString);
                    break;
                default:
                    break;
            }
        }
    };

    public class EPCAdapter extends BaseAdapter {
        public List<EPC> mList = new ArrayList<EPC>();
        LayoutInflater inflater;
        public synchronized void setList() {
            synchronized (this) {
                if (mEPCList != null && mEPCList.size() > 0) {
                    mList.clear();
                    mList.addAll(mEPCList);
                }
            }
        }

        public EPCAdapter() {
            inflater = LayoutInflater.from(mContext);
        }

        @Override
        public int getCount() {
            if (mList == null) {
                return 0;
            }
            return mList.size();
        }

        @Override
        public Object getItem(int arg0) {
            return mList.get(arg0);
        }

        @Override
        public long getItemId(int arg0) {
            return arg0;
        }

        @Override
        public View getView(int position, View concertView, ViewGroup arg2) {
            if (concertView == null) {
                concertView = inflater.inflate(R.layout.item_epc, null);
            }
            setInfo(concertView, position);
            if (mSelectIndex == position) {
                concertView.setBackgroundColor(mContext.getResources().getColor(R.color.gainsboro));
            } else {
                concertView.setBackgroundColor(mContext.getResources().getColor(R.color.white));
            }
            return concertView;
        }

        private void setInfo(View v, int position) {
            if (mList == null || mList.size() == 0) {
                return;
            }
            EPC epc = mList.get(position);
            TextView sequence = (TextView) v.findViewById(R.id.tv_sequence);
            TextView epcid = (TextView) v.findViewById(R.id.tv_epcid);
            TextView nums = (TextView) v.findViewById(R.id.tv_nums);
            TextView rssi = (TextView) v.findViewById(R.id.tv_rssi);
            TextView embeded = (TextView) v.findViewById(R.id.tv_embeded);

            sequence.setText(String.valueOf(position + 1));
            if (mBarcodeConfig.getValue("PARAMETER_HIDE_PC", 1) == 0) {
                try {
                    SpannableStringBuilder style = new SpannableStringBuilder(epc.getId());
                    style.setSpan(new ForegroundColorSpan(Color.BLUE), 0, 4, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);
                    epcid.setText(style);
                } catch (IndexOutOfBoundsException e) {
                    e.printStackTrace();
                }
            } else {
                epcid.setText(epc.getId());
            }
            nums.setText(String.valueOf(epc.count));
            rssi.setText(String.valueOf(epc.rssi));
            embeded.setText(epc.getEmbeded());
        }
    }

    private void checkStatus() {
        // 20170417
        synchronized (mAdapter.mList) {
            if (mAdapter.mList != null && mAdapter.mList.size() > 0) {
                long totalCount = 0;
                for (EPC epc : mAdapter.mList) {
                    totalCount += epc.count;
                }
                if(m_time - m_timenow > 500) {
                    tv_speed.setText("" + (totalCount - m_speednum)*2);
                    m_speednum = totalCount;
                    m_timenow = m_time;
                }
                tv_totalnums.setText(String.valueOf(totalCount));
                tv_tagnums.setText(String.valueOf(mAdapter.mList.size()));
                tv_time.setText(String.valueOf(m_time));
            } else {
                tv_totalnums.setText("");
                tv_tagnums.setText("");
            }
        }
        if (mInventoryStart || isstart) {
            mSeek_continue_bt.setText(mContext.getResources().getString(R.string.msg_stop));
        } else {
            mSeek_continue_bt.setText(mContext.getResources().getString(R.string.msg_continue_seek));
        }
    }

    ListView mSeek_ls;
    Button mClearEPC;
    Button mSeek_continue_bt;
    RadioGroup mSelect_rg;
    Spinner sp_invmode;
    TextView tv_invtime;
    EditText et_invtime;
    TextView tv_speed_name;
    TextView tv_speed_unit;
    TextView tv_speed;
    LinearLayout ll_invtime;
    LinearLayout rl_filter1;
    LinearLayout rl_filter2;
    LinearLayout rl_filter3;
    LinearLayout ordinary_filter;
    RadioGroup rg_filter_match;
    EditText et_filter_offset;
    EditText et_filter_len;
    EditText et_filter_data;
    Spinner sp_filter_bank;
    TextView tv_filter_bank;
    TextView tv_filter_data;
    TextView tv_filter_len;
    TextView tv_filter_offset;
    RadioButton rb_filter_match;
    RadioButton rb_filter_mismatch;
    Button btn_filter_ok;

    TextView tv_time;
    CheckBox cb_filter;
    TextView tv_tagnums;
    TextView tv_totalnums;
    TextView tv_time_v;
    TextView tv_tagnums_v;
    TextView tv_totalnums_v;
    TextView tv_sequence;
    TextView tv_epc_id;
    TextView tv_nums;
    TextView tv_add_data;

    /**
     * @author sxc
     * @Description:
     * @date 10:03
     * @version V1.0
     */
    LinearLayout special_filter;
    Spinner pow_select, factory_select, ecp_select;
    TextView pow_text, pow_unit;
    EditText pow_value;
    Button pow_func;
    CheckBox cn_special;
    ArrayList<StateVO> listVOs;
    List<String> data_list;
    ArrayAdapter<String> arr_adapter;
    MyAdapter myAdapter;
    TextView tv_choose_power;
    TextView tv_choose_factory;
    TextView tv_select_epc;

    public void set_Adapter(){
        pow_select_adapter = new ArrayAdapter<String>(mContext,android.R.layout.simple_spinner_item,getResources().getStringArray(R.array.pow_select));
        pow_select_adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        pow_select.setAdapter(pow_select_adapter);
        invmode_adapter = new ArrayAdapter<String>(mContext,android.R.layout.simple_spinner_item,getResources().getStringArray(R.array.invmode));
        invmode_adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        sp_invmode.setAdapter(invmode_adapter);
    }

    private void initView() {
        mSeek_ls = (ListView) mCurrentView.findViewById(R.id.ls_seek);
        mSeek_ls.setOnItemClickListener(new OnItemClickListener() {

            @Override
            public void onItemClick(AdapterView<?> arg0, View arg1, int position,
                                    long arg3) {
                if (mSelectIndex == position) {
                    mSelectIndex = -1;
                } else {
                    mSelectIndex = position;
                }
                mAdapter.setList();
                mAdapter.notifyDataSetChanged();
                checkStatus();
            }
        });
        tv_totalnums = (TextView) mCurrentView.findViewById(R.id.tv_totalnums);
        tv_tagnums = (TextView) mCurrentView.findViewById(R.id.tv_tagnums);
        tv_totalnums_v = (TextView) mCurrentView.findViewById(R.id.tv_totalnums_v);
        tv_tagnums_v = (TextView) mCurrentView.findViewById(R.id.tv_tagnums_v);

        tv_sequence = (TextView) mCurrentView.findViewById(R.id.tv_sequence);
        tv_epc_id = (TextView) mCurrentView.findViewById(R.id.tv_epc_id);
        tv_nums = (TextView) mCurrentView.findViewById(R.id.tv_nums);
        tv_add_data = (TextView) mCurrentView.findViewById(R.id.tv_add_data);

        mClearEPC = (Button) mCurrentView.findViewById(R.id.btn_clear_epc);
        mClearEPC.setOnClickListener(this);
        mSeek_continue_bt = (Button) mCurrentView.findViewById(R.id.btn_seek_continue);
        mSeek_continue_bt.setOnClickListener(this);
        mAdapter = new EPCAdapter();

        mAdapter.setList();
        mSeek_ls.setAdapter(mAdapter);
        mSelect_rg = (RadioGroup) mCurrentView.findViewById(R.id.rg_select);
        tv_speed = mCurrentView.findViewById(R.id.tv_speed);
        tv_speed_name = mCurrentView.findViewById(R.id.tv_speed_name);
        tv_speed_unit = mCurrentView.findViewById(R.id.tv_speed_unit);
        ll_invtime = mCurrentView.findViewById(R.id.ll_invtime);
        tv_invtime = mCurrentView.findViewById(R.id.tv_invtime);
        et_invtime = mCurrentView.findViewById(R.id.et_invtime);
        et_invtime.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {

            }
            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {

            }
            @Override
            public void afterTextChanged(Editable s) {
                String input = s.toString();
                try {
                    int number = Integer.parseInt(input);
                    if(number < 1){
                        mInvModeValid = false;
                        et_invtime.setError(mContext.getResources().getString(R.string.working_time_int));
                    }else {
                        mInvModeValid = true;
                    }
                } catch (NumberFormatException e) {
                    mInvModeValid = false;
                    et_invtime.setError(mContext.getResources().getString(R.string.working_time_int));
                }
            }
        });
        sp_invmode = mCurrentView.findViewById(R.id.sp_invmode);
        sp_invmode.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener(){
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                if (position == 0) {
                    mIsContinue = true;
                    checkStatus();
                    mConfig.set(Appconfig.CONTINUE_SEEK, true);
                    mConfig.set(Appconfig.CONTINUE_TIME, false);
                    ll_invtime.setVisibility(View.GONE);
                } else if(position == 1) {
                    mIsContinue = false;
                    checkStatus();
                    mConfig.set(Appconfig.CONTINUE_SEEK, false);
                    mConfig.set(Appconfig.CONTINUE_TIME, false);
                    ll_invtime.setVisibility(View.GONE);
                } else{
                    ll_invtime.setVisibility(View.VISIBLE);
                    mIsContinue = true;
                    checkStatus();
                    mConfig.set(Appconfig.CONTINUE_SEEK, true);
                    mConfig.set(Appconfig.CONTINUE_TIME, true);
                }
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) {

            }
        });

        tv_time = (TextView) mCurrentView.findViewById(R.id.tv_time);
        tv_time_v = (TextView) mCurrentView.findViewById(R.id.tv_time_v);

        cb_filter = (CheckBox) mCurrentView.findViewById(R.id.cb_filter);
        cn_special = (CheckBox) mCurrentView.findViewById(R.id.cn_special);
        cb_filter.setOnCheckedChangeListener(new OnMyCheckedChangedListener());
        cn_special.setOnCheckedChangeListener(new OnMyCheckedChangedListener());
        rl_filter1 = (LinearLayout) mCurrentView.findViewById(R.id.rl_filter1);
        rl_filter2 = (LinearLayout) mCurrentView.findViewById(R.id.rl_filter2);
        et_filter_data = (EditText) mCurrentView.findViewById(R.id.et_filter_data);
        rl_filter3 = (LinearLayout) mCurrentView.findViewById(R.id.rl_filter3);
        ordinary_filter = (LinearLayout) mCurrentView.findViewById(R.id.ordinary_filter);
        et_filter_offset = (EditText) mCurrentView.findViewById(R.id.et_filter_offset);
        et_filter_len = (EditText) mCurrentView.findViewById(R.id.et_filter_len);

        tv_filter_bank = (TextView) mCurrentView.findViewById(R.id.tv_filter_bank);
        tv_filter_data = (TextView) mCurrentView.findViewById(R.id.tv_filter_data);
        tv_filter_len = (TextView) mCurrentView.findViewById(R.id.tv_filter_len);
        tv_filter_offset = (TextView) mCurrentView.findViewById(R.id.tv_filter_offset);

        tv_choose_power = (TextView) mCurrentView.findViewById(R.id.tv_choose_power);
        tv_choose_factory = (TextView) mCurrentView.findViewById(R.id.tv_choose_factory);
        tv_select_epc = (TextView) mCurrentView.findViewById(R.id.tv_select_epc);

        rg_filter_match = (RadioGroup) mCurrentView.findViewById(R.id.rg_filter_match);
        sp_filter_bank = (Spinner) mCurrentView.findViewById(R.id.sp_filter_bank);

        rb_filter_match = (RadioButton) mCurrentView.findViewById(R.id.rb_filter_match);
        rb_filter_match.setOnClickListener(this);
        rb_filter_mismatch = (RadioButton) mCurrentView.findViewById(R.id.rb_filter_mismatch);
        rb_filter_mismatch.setOnClickListener(this);
        btn_filter_ok = (Button) mCurrentView.findViewById(R.id.btn_filter_ok);
        btn_filter_ok.setOnClickListener(this);
        //
        arrFilter_bank = R.array.filter_bank;
        ArrayAdapter adapter_filterbank = ArrayAdapter.createFromResource(mContext, arrFilter_bank, android.R.layout.simple_spinner_item);
        adapter_filterbank.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        sp_filter_bank.setAdapter(adapter_filterbank);

        special_filter = (LinearLayout) mCurrentView.findViewById(R.id.special_filter);
        pow_select = (Spinner) mCurrentView.findViewById(R.id.pow_select);

        listVOs = new ArrayList<>();
        data_list = new ArrayList<String>();
        arr_adapter = new ArrayAdapter<String>(getActivity(), android.R.layout.simple_spinner_item, data_list);
        myAdapter = new MyAdapter(getActivity(), 0, listVOs);

        factory_select = (Spinner) mCurrentView.findViewById(R.id.factory_select);
        ecp_select = (Spinner) mCurrentView.findViewById(R.id.ecp_select);
        pow_text = (TextView) mCurrentView.findViewById(R.id.pow_text);
        pow_value = (EditText) mCurrentView.findViewById(R.id.pow_value);
        pow_unit = (TextView) mCurrentView.findViewById(R.id.pow_unit);
        pow_func = (Button) mCurrentView.findViewById(R.id.pow_func);
        pow_func.setOnClickListener(this);

        pow_select.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                if (position == 0) {
                    pow_value.setText("");
                    listVOs.clear();
                    myAdapter.notifyDataSetChanged();
                    pow_text.setText(getResources().getString(R.string.select_text_temperature));
                    pow_unit.setText(getResources().getString(R.string.select_unit_tem));
                    pow_func.setText(getResources().getString(R.string.tem_get_tem));
                    String[] citys = getResources().getStringArray(R.array.factory_select1);
                    if (DisplayUtil.getUhfPad().equals("r2000D") || DisplayUtil.getUhfPad().contains("TM600")|| DisplayUtil.getUhfPad().contains("E710")
                            || DisplayUtil.getUhfPad().contains("E510")|| DisplayUtil.getUhfPad().contains("1616E"))
                        citys = getResources().getStringArray(R.array.factory_select2);
                    ArrayAdapter aa = new ArrayAdapter(getActivity(), android.R.layout.simple_spinner_item, citys);
                    aa.setDropDownViewResource(R.layout.factory_item);
                    factory_select.setAdapter(aa);
                    if (AppCache.Temp_pos_factory != 0 && pow_select.getSelectedItemPosition() == 0) {
                        factory_select.setSelection(AppCache.Temp_pos_factory);
                    }
                    AppCache.ledfun = false;
                } else {
                    pow_value.setText("");
                    data_list.clear();
                    arr_adapter.notifyDataSetChanged();
                    pow_text.setText(getResources().getString(R.string.select_text_quantity));
                    pow_unit.setText(getResources().getString(R.string.select_unit_num));
                    pow_func.setText(getResources().getString(R.string.tem_get_lec));
                    String[] citys = getResources().getStringArray(R.array.factory_select);
                    if (DisplayUtil.getUhfPad().equals("r2000D") || DisplayUtil.getUhfPad().contains("TM600")|| DisplayUtil.getUhfPad().contains("E710")
                            || DisplayUtil.getUhfPad().contains("E510") || DisplayUtil.getUhfPad().contains("1616E"))
                        citys = getResources().getStringArray(R.array.factory_select3);
                    ArrayAdapter aa = new ArrayAdapter(getActivity(), android.R.layout.simple_spinner_item, citys);
                    aa.setDropDownViewResource(R.layout.factory_item);
                    factory_select.setAdapter(aa);
                    if (AppCache.LED_pos_factory != 0 && pow_select.getSelectedItemPosition() == 1) {
                        factory_select.setSelection(AppCache.LED_pos_factory);
                    }
                    if(isYiLianLed())
                        AppCache.ledfun = true;
                }
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) {

            }
        });

        factory_select.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                if (pow_select.getSelectedItemPosition() == 1) {
                    AppCache.LED_pos_factory = factory_select.getSelectedItemPosition();
                    if(isYiLianLed()){
                        AppCache.ledfun = true;
                    } else {
                        AppCache.ledfun = false;
                    }
                } else {
                    AppCache.Temp_pos_factory = factory_select.getSelectedItemPosition();
                }
                setSpecialFilter();
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) {

            }
        });
    }

    public class OnMyCheckedChangedListener implements CompoundButton.OnCheckedChangeListener {

        @Override
        public void onCheckedChanged(CompoundButton buttonView, boolean isChecked) {
            switch (buttonView.getId()) {
                case R.id.cb_filter:
                    if (isChecked) {
                        ordinary_filter.setVisibility(View.VISIBLE);
                        cn_special.setChecked(false);
                        if (mConfig.moduleType == 0) {
                            String version = mService.getFirmwareVersion();
                            if (version != null) {
                                if (version.equals("2.6.0.240"))
                                    mConfig.set("moduleType", 1);
                                else
                                    mConfig.set("moduleType", 2);
                            }
                        }
                        if (mConfig.moduleType == 1) {
                            sp_filter_bank.setEnabled(false);
                            rg_filter_match.setVisibility(View.GONE);
                        }
                        mHandler.sendEmptyMessage(FILTER);
                        mConfig.isFilter = true;
                    } else {
                        ordinary_filter.setVisibility(View.GONE);
                        mService.setParamBytes(UHFService.PARAMETER_TAG_FILTER, null);
                        mConfig.isFilter = false;
                    }
                    break;
                case R.id.cn_special:
                    if (isChecked) {
                        if(isYiLianLed())
                            AppCache.ledfun = true;

                        cb_filter.setChecked(false);
                        special_filter.setVisibility(View.VISIBLE);
                        sp_invmode.setSelection(0);
                        mConfig.set(Appconfig.CONTINUE_SEEK, true);
                        setSpecialFilter();
                        sp_invmode.setEnabled(false);
                        mConfig.isSpecial = true;
                    } else {
                        special_filter.setVisibility(View.GONE);
                        mService.setParamBytes(UHFService.PARAMETER_TAG_EMBEDEDDATA, null);
                        mService.setParamBytes(UHFService.PARAMETER_TAG_FILTER, null);
                        mConfig.isFilter = false;
                        if (mConfig.isEmbeded) {
                            setEmbededData();
                        }
                        sp_invmode.setEnabled(true);
                        if (sp_invmode.getSelectedItemPosition() == 0) {
                            mConfig.set(Appconfig.CONTINUE_SEEK, true);
                        } else {
                            mConfig.set(Appconfig.CONTINUE_SEEK, false);
                        }
                        AppCache.ledfun = false;
                        mConfig.isSpecial = false;
                        mService.setParameters(UHFService.PARAMETER_INVENTORY_SESSION, mBarcodeConfig.getValue("PARAMETER_INVENTORY_SESSION", 1));
                        mService.setParameters(UHFService.PARAMETER_INVENTORY_SESSION_TARGET, mBarcodeConfig.getValue("PARAMETER_INVENTORY_SESSION_TARGET", 0));//A
                    }
                    break;
            }
        }
    }

    class UHFDataReciever extends BroadcastReceiver {

        @Override
        public void onReceive(Context context, Intent intent) {
            if (mConfig.continueSeek) {
                mHandler.sendEmptyMessage(INVENTORY);
            } else {
                mHandler.sendEmptyMessage(ONCE);
            }
        }
    }

    private void doStartThread() {
        try {
            if (mThread != null && mThread.isAlive()) {
                doStopThread();
            }
            mInventoryStart = true;
            mThread = new InventoryThread();
            soundThread = new SoundThread();
            mThread.start();
            soundThread.start();
        } catch (Exception e) {
            e.printStackTrace();
            LogUtil.e(TAG, "doStartThread", e);
        }
    }

    private void doStopThread() {
        try {
            if (mThread == null || mThread.isInterrupted()) {
                return;
            }
            mThread.interrupt();
            soundThread.interrupt();
            mThread = null;
            soundThread = null;
        } catch (Exception e) {
            e.printStackTrace();
            LogUtil.e(TAG, "doStopThread", e);
        }
    }

    private void doLedThread() {
        try {
            getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            if (ledthread != null && ledthread.isAlive()) {
                doStopLedThread();
            }
            clearEPCList();
            isstart = true;
            ledthread = new LEDReadThread();
            ledthread.start();

        } catch (Exception e) {
            e.printStackTrace();
            LogUtil.e(TAG, "doStartThread", e);
        }
    }

    private void doStopLedThread() {
        try {
            getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            if (ledthread == null || ledthread.isInterrupted()) {
                return;
            }
            isstart = false;
            ledthread.interrupt();
            ledthread = null;
            AppCache.setScanEnable(true);
        } catch (Exception e) {
            e.printStackTrace();
            LogUtil.e(TAG, "doStopThread", e);
        }
    }

    class InventoryThread extends Thread {
        @Override
        public void run() {
            while (mInventoryStart) {
                try {
                    sleep(50);
                    mEPCUtil.loadData_new();
                } catch (InterruptedException e) {
                    LogUtil.e(TAG, "InventoryThread interrupted");
                }
                mHandler.sendEmptyMessage(INVENTORY);
            }
            mHandler.removeMessages(INVENTORY);
        }
    }

    private class LEDReadThread extends Thread {
        @Override
        public void run() {
            while (isstart) {
                try {
                    mUHFLogic.inventoryOnce_led(mEPCUtil);
                    m_time = SystemClock.elapsedRealtime() - statenvtick;
                    tv_time.setText(String.valueOf(m_time));
                    mHandler.sendEmptyMessage(LED_ONCE);
                    setSpecialFilter();
                } catch (Exception e) {
                    LogUtil.e(TAG, "Inventory thread interrupted");
                }
            }
        }
    }

    private class SoundThread extends Thread {
        @Override
        public void run() {
            while (mInventoryStart) {
                try {
                    sleep(50);
                    if (mConfig.soundRepeat == 1) {
                        if (mEPCUtil.compareNumsAll() || mEPCUtil.compareNums()) {
                            mEPCUtil.playsound();
                            sleep(50);
                            mEPCUtil.playsound();
                        }
                    }else{
                        if (mEPCUtil.compareNums()) {
                            mEPCUtil.playsound();
                        }
                    }
                } catch (Exception e) {
                    LogUtil.e(TAG, "Inventory thread interrupted");
                }
            }
        }
    }

    private void doKLWThread() {
        try {
            getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            if (klwthread != null && klwthread.isAlive()) {
                doStopKLWThread();
            }
            isstart = true;
            klwthread = new KLWReadThread();
            klwthread.start();
        } catch (Exception e) {
            e.printStackTrace();
            LogUtil.e(TAG, "doStartThread", e);
        }
    }

    private void doStopKLWThread() {
        try {
            getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            if (klwthread == null || klwthread.isInterrupted()) {
                return;
            }
            isstart = false;
            if(DisplayUtil.getUhfPad().contains("E710") || DisplayUtil.getUhfPad().contains("E510")) {
                sleep(50);
                mService.inventoryStop();
            }
            klwthread.join();
            klwthread = null;
        } catch (Exception e) {
            e.printStackTrace();
            LogUtil.e(TAG, "doStopThread", e);
        }
    }

    private class KLWReadThread extends Thread {
        @Override
        public void run() {
            try {
                String factory = factory_select.getSelectedItem().toString();
                if (factory.equals("KX2005X-BL") || factory.equals("N2ESL") || factory.equals("VBL")) {
                    while (isstart) {
                        for (int i = 1; i < listVOs.size(); i++) {
                            if (!isstart)
                                break;
                            if (listVOs.get(i).isSelected()) {
                                String epcid = listVOs.get(i).getTitle();
                                byte[] val = new byte[255];
                                val[0] = (byte) (1);
                                val[1] = (byte) (0);
                                val[2] = (byte) (epcid.length() / 2);
                                byte[] data = BaseUtil.getHexByteArray(epcid);
                                System.arraycopy(data, 0, val, 4, val[2]);
                                mService.setParamBytes(UHFService.PARAMETER_TAG_FILTER, val);
                                if(DisplayUtil.getUhfPad().contains("E710") || DisplayUtil.getUhfPad().contains("E510")){
                                    mService.inventoryStart();
                                    sleep(50);
                                }else{
                                    mService.inventoryStart();
                                    sleep(200);
                                    mService.inventoryStop();
                                }
                            }
                        }
                    }
                } else if (factory.equals("B5020M1-T1E")) {
                    while (isstart) {
                        for (int i = 1; i < listVOs.size(); i++) {
                            if (!isstart)
                                break;
                            if (listVOs.get(i).isSelected()) {
                                String epcid = listVOs.get(i).getTitle();
                                mService.readTagLED(BaseUtil.getHexByteArray(epcid), password_0, 1);
                            }
                        }
                    }
                }
            } catch (Exception e) {
                LogUtil.e(TAG, "Inventory thread interrupted");
            }
        }
    }

    class MyReceiver extends BroadcastReceiver {

        @Override
        public void onReceive(Context context, Intent intent) {
            LogUtil.i(TAG, "onReceive: " + intent.getAction());
            if (intent.getAction().equals("com.seuic.uhftool.service.start")) {
                clearEPCList();
                mInventoryStart = true;
                sp_invmode.setEnabled(false);
                et_invtime.setEnabled(false);
                cb_filter.setEnabled(false);
                cn_special.setEnabled(false);
                mClearEPC.setEnabled(false);
                pow_select.setEnabled(false);
                factory_select.setEnabled(false);
                btn_filter_ok.setEnabled(false);
                mSeek_continue_bt.setEnabled(false);
                pow_func.setEnabled(false);
                mSeek_continue_bt.setText(mContext.getResources().getString(R.string.msg_stop));
                statenvtick = SystemClock.elapsedRealtime();
                getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else if (intent.getAction().equals("com.seuic.uhftool.service.stop")) {
                mInventoryStart = false;
                if (!cn_special.isChecked()) {
                    sp_invmode.setEnabled(true);
                }
                et_invtime.setEnabled(true);
                cb_filter.setEnabled(true);
                cn_special.setEnabled(true);
                mClearEPC.setEnabled(true);
                pow_select.setEnabled(true);
                factory_select.setEnabled(true);
                btn_filter_ok.setEnabled(true);
                mSeek_continue_bt.setEnabled(true);
                pow_func.setEnabled(true);
                mSeek_continue_bt.setText(mContext.getResources().getString(R.string.msg_continue_seek));
                getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else if (intent.getAction().equals("com.seuic.uhftool.service.ledstart")) {
                isstart = true;
                doLedThread();
                setSpecialFilter();
                cb_filter.setEnabled(false);
                cn_special.setEnabled(false);
                mClearEPC.setEnabled(false);
                btn_filter_ok.setEnabled(false);
                mSeek_continue_bt.setEnabled(false);
                pow_select.setEnabled(false);
                factory_select.setEnabled(false);
                pow_func.setEnabled(false);
                mSeek_continue_bt.setText(mContext.getResources().getString(R.string.msg_stop));
                statenvtick = SystemClock.elapsedRealtime();
            }else if (intent.getAction().equals("com.seuic.uhftool.service.ledstop")){
                isstart=false;
                doStopLedThread();
                cb_filter.setEnabled(true);
                pow_select.setEnabled(true);
                factory_select.setEnabled(true);
                cn_special.setEnabled(true);
                mClearEPC.setEnabled(true);
                btn_filter_ok.setEnabled(true);
                mSeek_continue_bt.setEnabled(true);
                pow_func.setEnabled(true);
                mSeek_continue_bt.setText(mContext.getResources().getString(R.string.msg_continue_seek));
            }
        }
    }

    boolean setEmbededData() {
        byte[] embd = new byte[255];
        embd[0] = (byte) mConfig.embededBank;
        embd[1] = (byte) mConfig.embededAddress;
        embd[2] = (byte) mConfig.embededLenth;
        System.arraycopy(BaseUtil.getHexByteArray(mConfig.embededPwd), 0, embd, 3, 4);
        return mService.setParamBytes(UHFService.PARAMETER_TAG_EMBEDEDDATA, embd);
    }

    boolean isYiLianLed(){
        if (pow_select.getSelectedItemPosition() == 1 && "B5020M1-T1E".equals(factory_select.getSelectedItem().toString()) ) {
            return true;
        }
        return false;
    }

    @Override
    public void onHiddenChanged(boolean hidden) {
        LogUtil.i(TAG, "setScanEnable 8888 = "+hidden);
        if (hidden) {
            AppCache.setScanEnable(false);
        } else {
            AppCache.setScanEnable(true);
        }
    }
}
