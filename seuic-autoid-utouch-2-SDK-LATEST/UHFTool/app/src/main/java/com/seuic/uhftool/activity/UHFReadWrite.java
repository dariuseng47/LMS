package com.seuic.uhftool.activity;

import java.util.ArrayList;
import java.util.List;

import android.content.Context;
import android.content.res.Configuration;
import android.os.Bundle;
import android.support.v4.app.Fragment;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.View.OnClickListener;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;
import android.text.TextUtils;
import com.seuic.uhf.EPC;
import com.seuic.uhf.UHFService;
import com.seuic.uhftool.AppCache;
import com.seuic.uhftool.util.BaseUtil;
import com.seuic.uhftool.Cache;
import com.seuic.uhftool.iml.IFragment;
import com.seuic.uhftool.R;
import com.seuic.uhftool.UHFLogic;

public class UHFReadWrite extends Fragment implements IFragment,
        OnClickListener {

    private static final String TAG = "UHFReadWrite";

    View mCurrentView;

    UHFLogic mUHFLogic;

    Context mContext;

    UHFService mService;

    String mEPC = "";

    String[] mBankChooses;

    int mBankIndex = 3;

    Cache mEPCUtil;

    SeekFragment mSeekFragment;

    private int arrLock_bank;
    private int arrLock;


    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        Log.d(TAG, "onCreateView: new View");
        mCurrentView = inflater.inflate(R.layout.fragment_readwrite, null);
        mContext = mCurrentView.getContext();
        mUHFLogic = new UHFLogic(mContext);
        mBankChooses = mContext.getResources().getStringArray(R.array.msg_bank_choose);
        initView();
        mEPCUtil = Cache.getInstance(mContext);
        mBankIndex = 3;
        return mCurrentView;
    }

    @Override
    public void onSaveInstanceState(Bundle outState) {
    }

    @Override
    public void refresh() {
        checkStatus();
    }
    @Override
    public void onResume() {
        super.onResume();
        AppCache.setSetting(1);
        try {
            if (mService == null) {
                mService = UHFService.getInstance();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onPause() {
        if(AppCache.isSetting() == 1)
		    AppCache.setScanEnable(true);
        if (mService == null) {
            mService = UHFService.getInstance();
        }

        super.onPause();
    }

    @Override
    public void getview() {
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        refresh_UI();
    }

    public void refresh_UI() {
        mRead_bt.setText(mContext.getResources().getString(R.string.msg_read_card));
        mWrite_bt.setText(mContext.getResources().getString(R.string.msg_write_card));
        mClear_bt.setText(mContext.getResources().getString(R.string.msg_clear));
        mLock_bt.setText(mContext.getResources().getString(R.string.msg_lock));
        mKill_bt.setText(mContext.getResources().getString(R.string.msg_kill));

        tv_tag_select.setText(mContext.getResources().getString(R.string.tag_select));
        tv_readwrite.setText(mContext.getResources().getString(R.string.msg_readwrite));
        tv_address.setText(mContext.getResources().getString(R.string.msg_address));
        tv_lengh.setText(mContext.getResources().getString(R.string.msg_lengh));
        tv_ac_psw.setText(mContext.getResources().getString(R.string.msg_ac_psw));
        tv_data.setText(mContext.getResources().getString(R.string.tag_data));
        tv_lock.setText(mContext.getResources().getString(R.string.msg_lock));
        tv_lock_bank.setText(mContext.getResources().getString(R.string.lock_bank));
        tv_lock_mode.setText(mContext.getResources().getString(R.string.lock_mode));
        tv_lock_ac_psw.setText(mContext.getResources().getString(R.string.msg_ac_psw));
        tv_lock_warning.setText(mContext.getResources().getString(R.string.lock_warning));
        tv_kill.setText(mContext.getResources().getString(R.string.msg_kill));
        tv_kill_psw.setText(mContext.getResources().getString(R.string.msg_kill_psw));

        setLockAdapter();
    }

    @Override
    public void onClick(View v) {
        switch (v.getId()) {

            case R.id.bt_read:
                if (checkTargetEPC()) {                                            //
                    if(!checkParam()) {
                        et_rw_data.setText("");
                        break;
                    }
                    byte[] data = new byte[Integer.parseInt(et_length.getText().toString())];
                    if (mUHFLogic.readTag(mEPC, et_ac_password.getText().toString(), String.valueOf(mBankIndex), et_address.getText().toString(), et_length.getText().toString(), data)) {
                        et_rw_data.setText(mUHFLogic.addFrefixSuffix(BaseUtil.getHexString(data, Integer.parseInt(et_length.getText().toString()), " "), true));
                        Toast.makeText(mContext, mContext.getResources().getString(R.string.msg_read_success), Toast.LENGTH_SHORT).show();
                    } else {
                        Toast.makeText(mContext, mContext.getResources().getString(R.string.msg_read_fail), Toast.LENGTH_SHORT).show();
                    }
                }else
                    Toast.makeText(mContext, mContext.getResources().getString(R.string.msg_target_epc), Toast.LENGTH_SHORT).show();

                break;

            case R.id.bt_write:
                if(checkTargetEPC()) {                                               //
                    if(!checkParam())
                        break;
                    if(et_rw_data.getText().toString().isEmpty()) {
                        Toast.makeText(mContext, mContext.getResources().getString(R.string.parameterisnot_correct), Toast.LENGTH_SHORT).show();
                        break;
                    }
                	if (mUHFLogic.writeTag(mEPC, et_ac_password.getText().toString(), String.valueOf(mBankIndex), et_address.getText().toString(), et_length.getText().toString(), et_rw_data.getText().toString())) {
                    	Toast.makeText(mContext, mContext.getResources().getString(R.string.msg_write_success), Toast.LENGTH_SHORT).show();
                	} else {
                    	Toast.makeText(mContext, mContext.getResources().getString(R.string.msg_write_fail), Toast.LENGTH_SHORT).show();
                	}
				}else
					Toast.makeText(mContext, mContext.getResources().getString(R.string.msg_target_epc), Toast.LENGTH_SHORT).show();

                break;

            case R.id.bt_clear:
                et_rw_data.setText("");
                break;

            case R.id.bt_blockwrite:
                if(checkTargetEPC()) {                                               //
                    if(!checkParam())
                        break;
					if (mUHFLogic.blockWriteTag(mEPC, et_ac_password.getText().toString(), String.valueOf(mBankIndex), et_address.getText().toString(), et_length.getText().toString(), et_rw_data.getText().toString())) {
                    	Toast.makeText(mContext, mContext.getResources().getString(R.string.msg_blockwrite_success), Toast.LENGTH_SHORT).show();
                	} else {
                    	Toast.makeText(mContext, mContext.getResources().getString(R.string.msg_blockwrite_fail), Toast.LENGTH_SHORT).show();
                	}
				}else
					Toast.makeText(mContext, mContext.getResources().getString(R.string.msg_target_epc), Toast.LENGTH_SHORT).show();

                break;
            case R.id.bt_blockerase:
                if(checkTargetEPC()) {
                    if(!checkParam())
                        break;
					if (mUHFLogic.blockEraseTag(mEPC, et_ac_password.getText().toString(), String.valueOf(mBankIndex), et_address.getText().toString(), et_length.getText().toString())) {
                    	Toast.makeText(mContext, mContext.getResources().getString(R.string.msg_blockerase_success), Toast.LENGTH_SHORT).show();
                	} else {
                    	Toast.makeText(mContext, mContext.getResources().getString(R.string.msg_blockerase_fail), Toast.LENGTH_SHORT).show();
                	}
				}else
					Toast.makeText(mContext, mContext.getResources().getString(R.string.msg_target_epc), Toast.LENGTH_SHORT).show();

                break;

            case R.id.rb_bank_epc:
                rb_bank_epc.setChecked(true);
                et_address.setText(String.valueOf(4));
                mBankIndex = 1;
                break;

            case R.id.rb_bank_tid:
                rb_bank_tid.setChecked(true);
                et_address.setText(String.valueOf(0));
                et_length.setText(String.valueOf(12));
                mBankIndex = 2;
                break;

            case R.id.rb_bank_user:
                rb_bank_user.setChecked(true);
                mBankIndex = 3;
                break;

            case R.id.rb_bank_psw:
                rb_bank_psw.setChecked(true);
                et_address.setText(String.valueOf(0));
                et_length.setText(String.valueOf(8));
                mBankIndex = 0;
                break;
            //0,1,2,3 unlock tags (0: Password area 1: EPC Area 2: TI Area 3: User Area)
//10,11,12,13 lock tags (10: Password Area 11: EPC Area 12: TI Area 13: User Area)
//20,21,22,23 Permanent lock tags (20: Password area 21: EPC Area 22: TI Area 23: User Area)
//30,31,32,33 permanent unlock tags (30: Password Area 31: EPC Area 32: TI Area 33: User Area)
            case R.id.bt_lock:
                if(checkTargetEPC()){
                    int lockbank = sp_lock_bank.getSelectedItemPosition();
                    int lock = sp_lock.getSelectedItemPosition();
                    mLockFlag = lock*10 + lockbank;
                    //LogUtil.i(TAG, "lockflag = " + mLockFlag);
                    if(TextUtils.isEmpty(ed_lock_password.getText()) || ed_lock_password.getText().toString().length() != 8){
                        Toast.makeText(mContext, mContext.getResources().getString(R.string.parameterisnot_correct), Toast.LENGTH_SHORT).show();
                        break;
                    }
                    if (mService.lockTag(BaseUtil.getHexByteArray(mEPC),
                        BaseUtil.getHexByteArray(ed_lock_password.getText().toString()), mLockFlag)) {
                        Toast.makeText(mContext, mContext.getResources().getString(R.string.msg_lock_success), Toast.LENGTH_SHORT).show();
                    } else {
                        Toast.makeText(mContext, mContext.getResources().getString(R.string.msg_lock_fail), Toast.LENGTH_SHORT).show();
                    }
                }else{
                    Toast.makeText(mContext, mContext.getResources().getString(R.string.msg_target_epc), Toast.LENGTH_SHORT).show();
                }
                break;
				
			case R.id.bt_kill:
                if(checkTargetEPC()) {
                    if(TextUtils.isEmpty(ed_kill_password.getText()) || ed_kill_password.getText().toString().length() != 8){
                        Toast.makeText(mContext, mContext.getResources().getString(R.string.parameterisnot_correct), Toast.LENGTH_SHORT).show();
                        break;
                    }
                    if (mUHFLogic.killTag(mEPC, ed_kill_password.getText().toString())) {
                        Toast.makeText(mContext, mContext.getResources().getString(R.string.msg_kill_success), Toast.LENGTH_SHORT).show();
                    } else {
                        Toast.makeText(mContext, mContext.getResources().getString(R.string.msg_kill_fail), Toast.LENGTH_SHORT).show();
                    }
                }else
                    Toast.makeText(mContext, mContext.getResources().getString(R.string.msg_target_epc), Toast.LENGTH_SHORT).show();
                break;
            default:
                break;
        }

    }

    int mLockFlag = -1;

    private void checkStatus() {
        mRead_bt.setEnabled(true);
        mWrite_bt.setEnabled(true);
        mLock_bt.setEnabled(true);
        et_rw_data.setEnabled(true);
    }

    Spinner sp_tag;
    RadioGroup rg_bank;
    RadioButton rb_bank_epc;
    RadioButton rb_bank_tid;
    RadioButton rb_bank_user;
    RadioButton rb_bank_psw;

    EditText et_address;
    EditText et_length;
    EditText et_ac_password;

    EditText et_rw_data;

    Button mRead_bt;
    Button mWrite_bt;
    Button mClear_bt;
    Button mBlockWrite;
    Button mBlockErase;

    Spinner sp_lock_bank;
    Spinner sp_lock;

    EditText ed_lock_password;
    Button mLock_bt;

    EditText ed_kill_password;
    Button mKill_bt;

    TextView tv_tag_select;
    TextView tv_readwrite;
    TextView tv_address;
    TextView tv_lengh;
    TextView tv_ac_psw;
    TextView tv_data;
    TextView tv_lock;
    TextView tv_lock_bank;
    TextView tv_lock_mode;
    TextView tv_lock_ac_psw;
    TextView tv_lock_warning;
    TextView tv_kill;
    TextView tv_kill_psw;

    private List<String> data_list;
    private ArrayAdapter<String> arr_adapter;

    private void initView() {
        tv_tag_select = (TextView) mCurrentView.findViewById(R.id.tv_tag_select);
        tv_readwrite = (TextView) mCurrentView.findViewById(R.id.tv_readwrite);
        tv_address = (TextView) mCurrentView.findViewById(R.id.tv_address);
        tv_lengh = (TextView) mCurrentView.findViewById(R.id.tv_lengh);
        tv_ac_psw = (TextView) mCurrentView.findViewById(R.id.tv_ac_psw);
        tv_data = (TextView) mCurrentView.findViewById(R.id.tv_data);
        tv_lock = (TextView) mCurrentView.findViewById(R.id.tv_lock);
        tv_lock_bank = (TextView) mCurrentView.findViewById(R.id.tv_lock_bank);
        tv_lock_mode = (TextView) mCurrentView.findViewById(R.id.tv_lock_mode);
        tv_lock_ac_psw = (TextView) mCurrentView.findViewById(R.id.tv_lock_ac_psw);
        tv_lock_warning = (TextView) mCurrentView.findViewById(R.id.tv_lock_warning);
        tv_kill = (TextView) mCurrentView.findViewById(R.id.tv_kill);
        tv_kill_psw = (TextView) mCurrentView.findViewById(R.id.tv_kill_psw);

        sp_tag = (Spinner) mCurrentView.findViewById(R.id.sp_tag);

        rg_bank = (RadioGroup) mCurrentView.findViewById(R.id.rg_bank);
        rb_bank_epc = (RadioButton) mCurrentView.findViewById(R.id.rb_bank_epc);
        rb_bank_epc.setOnClickListener(this);
        rb_bank_tid = (RadioButton) mCurrentView.findViewById(R.id.rb_bank_tid);
        rb_bank_tid.setOnClickListener(this);
        rb_bank_user = (RadioButton) mCurrentView.findViewById(R.id.rb_bank_user);
        rb_bank_user.setOnClickListener(this);
        rb_bank_psw = (RadioButton) mCurrentView.findViewById(R.id.rb_bank_psw);
        rb_bank_psw.setOnClickListener(this);

        et_address = (EditText) mCurrentView.findViewById(R.id.et_address);
        et_address.setText("0");
        et_length = (EditText) mCurrentView.findViewById(R.id.et_length);
        et_length.setText("2");
        et_ac_password = (EditText) mCurrentView.findViewById(R.id.et_ac_password);
        et_ac_password.setText("00000000");

        mRead_bt = (Button) mCurrentView.findViewById(R.id.bt_read);
        mRead_bt.setOnClickListener(this);
        mWrite_bt = (Button) mCurrentView.findViewById(R.id.bt_write);
        mWrite_bt.setOnClickListener(this);
        mClear_bt = (Button) mCurrentView.findViewById(R.id.bt_clear);
        mClear_bt.setOnClickListener(this);

        mBlockWrite = (Button) mCurrentView.findViewById(R.id.bt_blockwrite);
        mBlockWrite.setOnClickListener(this);
        mBlockErase = (Button) mCurrentView.findViewById(R.id.bt_blockerase);
        mBlockErase.setOnClickListener(this);

        et_rw_data = (EditText) mCurrentView.findViewById(R.id.et_rw_data);

        sp_lock_bank = (Spinner) mCurrentView.findViewById(R.id.sp_lock_bank);
        sp_lock = (Spinner) mCurrentView.findViewById(R.id.sp_lock);

        ed_lock_password = (EditText) mCurrentView.findViewById(R.id.ed_lock_password);
        mLock_bt = (Button) mCurrentView.findViewById(R.id.bt_lock);
        mLock_bt.setOnClickListener(this);

        ed_kill_password = (EditText) mCurrentView.findViewById(R.id.ed_kill_password);
		mKill_bt = (Button) mCurrentView.findViewById(R.id.bt_kill);
        mKill_bt.setOnClickListener(this);

        //
        data_list = new ArrayList<String>();
        if (mSeekFragment.mAdapter.mList != null && mSeekFragment.mAdapter.mList.size() > 0) {
            for (EPC epc : mSeekFragment.mAdapter.mList) {
                data_list.add(epc.getId());
            }
        }
        //
        arr_adapter= new ArrayAdapter<String>(getActivity(), android.R.layout.simple_spinner_item, data_list);
        //
        arr_adapter.setDropDownViewResource(R.layout.epc_spinner_item);
        //
        sp_tag.setAdapter(arr_adapter);

        setLockAdapter();
    }

    public void setLockAdapter() {
        //
        arrLock_bank = R.array.msg_bank_choose;
        ArrayAdapter adapter_lockbank = ArrayAdapter.createFromResource(mContext, arrLock_bank, android.R.layout.simple_spinner_item);
        adapter_lockbank.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        sp_lock_bank.setAdapter(adapter_lockbank);
        //
        arrLock = R.array.lock;
        ArrayAdapter adapter_lock = ArrayAdapter.createFromResource(mContext, arrLock, android.R.layout.simple_spinner_item);
        adapter_lock.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        sp_lock.setAdapter(adapter_lock);
    }

    public boolean checkTargetEPC() {
        if(arr_adapter.isEmpty()){
            return false;
        }
        mEPC = sp_tag.getSelectedItem().toString();
        if (mEPC.isEmpty()) {
            return false;
        } else {
            return true;
        }
    }

    public boolean checkParam() {
        if((TextUtils.isEmpty(et_address.getText()))||(TextUtils.isEmpty(et_length.getText()))
                ||(TextUtils.isEmpty(et_ac_password.getText()))){
            Toast.makeText(mContext, mContext.getResources().getString(R.string.value_cannot_empty), Toast.LENGTH_SHORT).show();
            return false;
        }
        if (Integer.parseInt(et_length.getText().toString()) == 0 || et_ac_password.getText().toString().length() != 8) {
            Toast.makeText(mContext, mContext.getResources().getString(R.string.parameterisnot_correct), Toast.LENGTH_SHORT).show();
            return false;
        }

        return true;
    }
    @Override
    public void onHiddenChanged(boolean hidden) {
        if (!hidden){
            initView();
            AppCache.setScanEnable(false);
        }
    }
}
