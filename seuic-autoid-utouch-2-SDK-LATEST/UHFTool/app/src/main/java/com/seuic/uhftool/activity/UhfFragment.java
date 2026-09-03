package com.seuic.uhftool.activity;

import static com.seuic.uhftool.BarcodeConfig.DEFAULT_MODEL;
import static com.seuic.uhftool.BarcodeConfig.MODEL_POWER;
import static com.seuic.uhftool.BarcodeConfig.MODEL_POWER_GEN2X;
import static com.seuic.uhftool.BarcodeConfig.MODEL_PROFILE;
import static com.seuic.uhftool.BarcodeConfig.MODEL_PROFILE_GEN2X;
import static com.seuic.uhftool.BarcodeConfig.MODEL_SESSION;
import static com.seuic.uhftool.BarcodeConfig.MODEL_SESSION_GEN2X;
import static com.seuic.uhftool.BarcodeConfig.MODEL_TARGET;
import static com.seuic.uhftool.BarcodeConfig.MODEL_TARGET_GEN2X;

import android.support.v4.app.Fragment;
import android.content.Context;
import android.content.res.Configuration;
import android.os.Bundle;
import android.text.TextUtils;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.View.OnClickListener;
import android.view.ViewGroup;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.CompoundButton;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.Spinner;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import com.seuic.uhf.UHFService;
import com.seuic.uhftool.AppCache;
import com.seuic.uhftool.Appconfig;
import com.seuic.uhftool.BarcodeConfig;
import com.seuic.uhftool.util.BaseUtil;
import com.seuic.uhftool.util.DisplayUtil;
import com.seuic.uhftool.iml.IFragment;
import com.seuic.uhftool.R;
import com.seuic.uhftool.util.MySpinnerAdapter;
import com.seuic.uhftool.util.ToastUtils;

/**
 * @author www
 */
public class UhfFragment extends Fragment implements IFragment, OnClickListener, CompoundButton.OnCheckedChangeListener {

    private static final String TAG = "UhfFragment";

    View mCurrentView;

    Context mContext;

    BarcodeConfig mConfig;
    Appconfig mAppconfig;

    UHFService mService;

    int mBankIndex = 2;
    Spinner sp_power, sp_region, sp_protocol;
    Button btn_setpower, btn_getpower, btn_setregion, btn_getregion, btn_setprotocol, btn_getprotocol, btn_gettemperature;
    Button btn_settag, btn_gettag, btn_setembeded;
    CheckBox cb_tagfocus, cb_fastid, cb_export, cb_embeded, cb_soundRepeat, cb_clearStart, cb_tidSort, cb_algorithm_6C;
    LinearLayout ll_add_data;
    RadioButton rb_embeded_password, rb_embeded_tid, rb_embeded_user, rb_standard_template, rb_gen2x_template;
    EditText et_temperature, et_embeded_address, et_embeded_length, et_embeded_acpwd;

    TextView tv_power, tv_region, tv_protocol, tv_tmp, tv_basic_param, tv_add_data;
    TextView tv_address, tv_lengh, tv_ac_psw, tv_add_data_warning, mode1_power, mode2_power, mode3_power, mode4_power,mode1_profile, mode2_profile, mode3_profile, mode4_profile;
    LinearLayout llModel, ll_gen2x_function, llMul, llModelWhole, llDistance, llMore, llCustom, llCustom_standard, llCustom_gen2x;
    TextView tvMultipleMultiple, tvMultipleWhole, tvSingleDistance, tvSingleMulti,
            tvCustom, tvMultipleMultiple_1, tvMultipleWhole_1, tvSingleDistance_1, tvSingleMulti_1;
    Switch swMultipleMultiple, swMultipleWhole, swSingleDistance, swSingleMulti, swCustom,
            swMultipleMultiple_gen2x, swMultipleWhole_gen2x, swSingleDistance_gen2x, swSingleMulti_gen2x, swCustom_gen2x;
    Spinner spModelSession, spModelProfile, spModelPower, spModelTarget, spModelSession_gen2x, spModelProfile_gen2x, spModelPower_gen2x, spModelTarget_gen2x;
    boolean isMulCheck = false, isModelWholeCheck = true, isDistanceCheck = true, isMoreCheck = true, isCustomCheck = true;
    boolean isShowAdvance;

    public static final int TEMPLATE0 = -1;
    public static final int TEMPLATE1 = 0;
    public static final int TEMPLATE2 = 1;
    public static final int TEMPLATE3 = 2;
    public static final int TEMPLATE4 = 3;
    public static final int TEMPLATE5 = 4;
    public static final int TEMPLATE6 = 5;
    public static final int TEMPLATE7 = 6;
    public static final int TEMPLATE8 = 7;
    public static final int TEMPLATE9 = 8;
    public static final int TEMPLATE10 = 9;

    public int mMode1_profile = 1;
    public int mMode2_profile = 1;
    public int mMode3_profile = 0;
    public int mMode4_profile = 2;

    String[] profile_options;
    int[] profile_values;

    private ArrayAdapter<String> region_adapter;

    private ArrayAdapter<String> power_adapter;

    public UhfFragment() {
    }

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        Log.d(TAG, "onCreateView: new View");
        mCurrentView = inflater.inflate(R.layout.fragment_uhf, null);
        mContext = mCurrentView.getContext();
        mConfig = BarcodeConfig.getInstance(mContext);
        mAppconfig = Appconfig.getInstance(mContext);
        mService = UHFService.getInstance();
        mConfig.setDefaultValues();
        initView();
        return mCurrentView;
    }

    private void getPreferenceValues() {
        int getpower = mService.getPower();
        if (getpower > 0 && getpower < 34) {
            sp_power.setSelection(getpower - 1);
        }
        getTagParam();
        if (mAppconfig.moduleType == 1) {
            ll_add_data.setVisibility(View.GONE);
            sp_region.setEnabled(false);
        } else {
            if (DisplayUtil.getUhfPad().contains("-EU") || DisplayUtil.isGMS()) {
                //sp_region.setEnabled(false);
            } else {
                if (mAppconfig.region.equals("FCC"))
                    sp_region.setSelection(0);
                else if (mAppconfig.region.equals("China1"))
                    sp_region.setSelection(1);
            }
            if (mAppconfig.isEmbeded) {
                cb_embeded.setChecked(true);
                Log.d(TAG, "embededBank = " + mAppconfig.embededBank);
                mBankIndex = mAppconfig.embededBank;
                if (mAppconfig.embededBank == 3)
                    rb_embeded_user.setChecked(true);
                else if (mAppconfig.embededBank == 0)
                    rb_embeded_password.setChecked(true);
                else
                    rb_embeded_tid.setChecked(true);
                et_embeded_address.setText(mAppconfig.embededAddress + "");
                et_embeded_length.setText(mAppconfig.embededLenth + "");
                et_embeded_acpwd.setText(mAppconfig.embededPwd);
                cb_tidSort.setEnabled(true);
            } else
                cb_embeded.setChecked(false);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        AppCache.setSetting(2);
        getPreferenceValues();
    }

    @Override
    public void onPause() {
        if (AppCache.isSetting() == 2)
            AppCache.setScanEnable(true);
        super.onPause();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        refresh_UI();
    }

    public void refresh_UI() {
        tv_basic_param.setText(mContext.getResources().getString(R.string.basic_param));
        tv_add_data.setText(mContext.getResources().getString(R.string.add_data));
        tv_address.setText(mContext.getResources().getString(R.string.msg_address));
        tv_lengh.setText(mContext.getResources().getString(R.string.msg_lengh));
        tv_ac_psw.setText(mContext.getResources().getString(R.string.msg_ac_psw));
        tv_add_data_warning.setText(mContext.getResources().getString(R.string.add_data_warning));
        tv_power.setText(mContext.getResources().getString(R.string.msg_power));
        tv_region.setText(mContext.getResources().getString(R.string.region));
        tv_protocol.setText(mContext.getResources().getString(R.string.protocol));
        tv_tmp.setText(mContext.getResources().getString(R.string.msg_tmp));

        btn_setpower.setText(mContext.getResources().getString(R.string.msg_set));
        btn_getpower.setText(mContext.getResources().getString(R.string.msg_get));
        btn_setregion.setText(mContext.getResources().getString(R.string.msg_set));
        btn_getregion.setText(mContext.getResources().getString(R.string.msg_get));
        btn_setprotocol.setText(mContext.getResources().getString(R.string.msg_set));
        btn_getprotocol.setText(mContext.getResources().getString(R.string.msg_get));
        btn_gettemperature.setText(mContext.getResources().getString(R.string.msg_get));
        cb_export.setText(mContext.getResources().getString(R.string.export));
        btn_settag.setText(mContext.getResources().getString(R.string.msg_set));
        btn_gettag.setText(mContext.getResources().getString(R.string.msg_get));
        cb_embeded.setText(mContext.getResources().getString(R.string.add_data_enable));
        btn_setembeded.setText(mContext.getResources().getString(R.string.msg_set));
        cb_soundRepeat.setText(mContext.getResources().getString(R.string.sound_repeat));
        cb_clearStart.setText(mContext.getResources().getString(R.string.clear_start));
        cb_tidSort.setText(mContext.getResources().getString(R.string.tid_sort));
        cb_algorithm_6C.setText(mContext.getResources().getString(R.string.algorithm_6C));
        rb_standard_template.setText(mContext.getResources().getString(R.string.general));
        setRegionAdapter();
        if (DisplayUtil.getUhfPad().equals("E710-US") || DisplayUtil.getUhfPad().contains("E510")|| DisplayUtil.getUhfPad().equals("TM600-C")) {
            mode1_power.setText("30dBm");
            mode2_power.setText("30dBm");
            mode3_power.setText("30dBm");
        }
        if(DisplayUtil.getUhfPad().contains("E510") || DisplayUtil.getUhfPad().equals("TM600-C"))
            mode4_power.setText("20dBm");
        llModel.setVisibility(View.VISIBLE);

        refreshModelUI();
    }

    @Override
    public void refresh() {
    }

    @Override
    public void getview() {
    }

    private void initView() {
        rb_standard_template = mCurrentView.findViewById(R.id.rb_standard_template);
        rb_standard_template.setOnClickListener(this);
        rb_gen2x_template = mCurrentView.findViewById(R.id.rb_gen2x_template);
        rb_gen2x_template.setOnClickListener(this);

        tv_power = (TextView) mCurrentView.findViewById(R.id.tv_power);
        tv_region = (TextView) mCurrentView.findViewById(R.id.tv_region);
        tv_protocol = (TextView) mCurrentView.findViewById(R.id.tv_protocol);
        tv_tmp = (TextView) mCurrentView.findViewById(R.id.tv_tmp);
        tv_basic_param = (TextView) mCurrentView.findViewById(R.id.tv_basic_param);
        tv_add_data = (TextView) mCurrentView.findViewById(R.id.tv_add_data);
        tv_address = (TextView) mCurrentView.findViewById(R.id.tv_address);
        tv_lengh = (TextView) mCurrentView.findViewById(R.id.tv_lengh);
        tv_ac_psw = (TextView) mCurrentView.findViewById(R.id.tv_ac_psw);
        tv_add_data_warning = (TextView) mCurrentView.findViewById(R.id.tv_add_data_warning);

        sp_power = (Spinner) mCurrentView.findViewById(R.id.sp_power);
        btn_setpower = (Button) mCurrentView.findViewById(R.id.btn_setpower);
        btn_setpower.setOnClickListener(this);
        btn_getpower = (Button) mCurrentView.findViewById(R.id.btn_getpower);
        btn_getpower.setOnClickListener(this);

        sp_region = (Spinner) mCurrentView.findViewById(R.id.sp_region);
        btn_setregion = (Button) mCurrentView.findViewById(R.id.btn_setregion);
        btn_setregion.setOnClickListener(this);
        btn_getregion = (Button) mCurrentView.findViewById(R.id.btn_getregion);
        btn_getregion.setOnClickListener(this);

        sp_protocol = (Spinner) mCurrentView.findViewById(R.id.sp_protocol);
        btn_setprotocol = (Button) mCurrentView.findViewById(R.id.btn_setprotocol);
        btn_setprotocol.setOnClickListener(this);
        btn_getprotocol = (Button) mCurrentView.findViewById(R.id.btn_getprotocol);
        btn_getprotocol.setOnClickListener(this);

        et_temperature = (EditText) mCurrentView.findViewById(R.id.et_temperature);
        btn_gettemperature = (Button) mCurrentView.findViewById(R.id.btn_gettemperature);
        btn_gettemperature.setOnClickListener(this);

        btn_settag = (Button) mCurrentView.findViewById(R.id.btn_settag);
        btn_settag.setOnClickListener(this);
        btn_gettag = (Button) mCurrentView.findViewById(R.id.btn_gettag);
        btn_gettag.setOnClickListener(this);

        cb_tagfocus = (CheckBox) mCurrentView.findViewById(R.id.cb_tagfocus);
        cb_tagfocus.setOnCheckedChangeListener(new OnMyCheckedChangedListener());

        cb_fastid = (CheckBox) mCurrentView.findViewById(R.id.cb_fastid);
        cb_fastid.setOnCheckedChangeListener(new OnMyCheckedChangedListener());

        cb_export = (CheckBox) mCurrentView.findViewById(R.id.cb_export);
        cb_export.setOnCheckedChangeListener(new OnMyCheckedChangedListener());

        ll_add_data = (LinearLayout) mCurrentView.findViewById(R.id.ll_add_data);
        rb_embeded_password = (RadioButton) mCurrentView.findViewById(R.id.rb_embeded_password);
        rb_embeded_password.setOnClickListener(this);
        rb_embeded_tid = (RadioButton) mCurrentView.findViewById(R.id.rb_embeded_tid);
        rb_embeded_tid.setOnClickListener(this);
        rb_embeded_user = (RadioButton) mCurrentView.findViewById(R.id.rb_embeded_user);
        rb_embeded_user.setOnClickListener(this);
        et_embeded_address = (EditText) mCurrentView.findViewById(R.id.et_embeded_address);
        et_embeded_address.setText("0");
        et_embeded_length = (EditText) mCurrentView.findViewById(R.id.et_embeded_length);
        et_embeded_length.setText("12");
        et_embeded_acpwd = (EditText) mCurrentView.findViewById(R.id.ed_embeded_acpwd);
        et_embeded_acpwd.setText("00000000");
        cb_embeded = (CheckBox) mCurrentView.findViewById(R.id.cb_embeded);
        cb_embeded.setOnCheckedChangeListener(new OnMyCheckedChangedListener());
        btn_setembeded = (Button) mCurrentView.findViewById(R.id.btn_setembeded);
        btn_setembeded.setOnClickListener(this);

        isShowAdvance = false;

        cb_soundRepeat = (CheckBox) mCurrentView.findViewById(R.id.cb_soundRepeat);
        cb_soundRepeat.setOnCheckedChangeListener(new OnMyCheckedChangedListener());
        cb_clearStart = (CheckBox) mCurrentView.findViewById(R.id.cb_clearStart);
        cb_clearStart.setOnCheckedChangeListener(new OnMyCheckedChangedListener());
        cb_tidSort = (CheckBox) mCurrentView.findViewById(R.id.cb_tidSort);
        cb_tidSort.setOnCheckedChangeListener(new OnMyCheckedChangedListener());
        cb_algorithm_6C = (CheckBox) mCurrentView.findViewById(R.id.cb_algorithm_6C);
        cb_algorithm_6C.setOnCheckedChangeListener(new OnMyCheckedChangedListener());

        setRegionAdapter();

        llModel = (LinearLayout) mCurrentView.findViewById(R.id.ll_model);
        ll_gen2x_function = (LinearLayout) mCurrentView.findViewById(R.id.ll_gen2x_function);

        tvMultipleMultiple = (TextView) mCurrentView.findViewById(R.id.tv_multiple_multiple);
        tvMultipleWhole = (TextView) mCurrentView.findViewById(R.id.tv_multiple_whole);
        tvSingleDistance = (TextView) mCurrentView.findViewById(R.id.tv_single_distance);
        tvSingleMulti = (TextView) mCurrentView.findViewById(R.id.tv_single_multi);
        tvCustom = (TextView) mCurrentView.findViewById(R.id.tv_custom);
        tvMultipleMultiple_1 = (TextView) mCurrentView.findViewById(R.id.tv_multiple_multiple_1);
        tvMultipleWhole_1 = (TextView) mCurrentView.findViewById(R.id.tv_multiple_whole_1);
        tvSingleDistance_1 = (TextView) mCurrentView.findViewById(R.id.tv_single_distance_1);
        tvSingleMulti_1 = (TextView) mCurrentView.findViewById(R.id.tv_single_multi_1);

        swMultipleMultiple = (Switch) mCurrentView.findViewById(R.id.sw_multiple_multiple);
        swMultipleWhole = (Switch) mCurrentView.findViewById(R.id.sw_multiple_whole);
        swSingleDistance = (Switch) mCurrentView.findViewById(R.id.sw_single_distance);
        swSingleMulti = (Switch) mCurrentView.findViewById(R.id.sw_single_multi);
        swCustom = (Switch) mCurrentView.findViewById(R.id.sw_custom);
        swMultipleMultiple_gen2x = (Switch) mCurrentView.findViewById(R.id.sw_multiple_multiple_gen2x);
        swMultipleWhole_gen2x = (Switch) mCurrentView.findViewById(R.id.sw_multiple_whole_gen2x);
        swSingleDistance_gen2x = (Switch) mCurrentView.findViewById(R.id.sw_single_distance_gen2x);
        swSingleMulti_gen2x = (Switch) mCurrentView.findViewById(R.id.sw_single_multi_gen2x);
        swCustom_gen2x = (Switch) mCurrentView.findViewById(R.id.sw_custom_gen2x);

        llMul = (LinearLayout) mCurrentView.findViewById(R.id.ll_mul);
        llModelWhole = (LinearLayout) mCurrentView.findViewById(R.id.ll_model_whole);
        llDistance = (LinearLayout) mCurrentView.findViewById(R.id.ll_distance);
        llMore = (LinearLayout) mCurrentView.findViewById(R.id.ll_more);
        llCustom = (LinearLayout) mCurrentView.findViewById(R.id.ll_custom);

        llCustom_standard = (LinearLayout) mCurrentView.findViewById(R.id.ll_custom_standard);
        spModelSession = (Spinner) mCurrentView.findViewById(R.id.sp_model_session);
        spModelProfile = (Spinner) mCurrentView.findViewById(R.id.sp_model_profile);
        spModelPower = (Spinner) mCurrentView.findViewById(R.id.sp_model_power);
        spModelTarget = (Spinner) mCurrentView.findViewById(R.id.sp_model_target);

        llCustom_gen2x = (LinearLayout) mCurrentView.findViewById(R.id.ll_custom_gen2x);
        spModelSession_gen2x = (Spinner) mCurrentView.findViewById(R.id.sp_model_session_gen2x);
        spModelProfile_gen2x = (Spinner) mCurrentView.findViewById(R.id.sp_model_profile_gen2x);
        spModelPower_gen2x = (Spinner) mCurrentView.findViewById(R.id.sp_model_power_gen2x);
        spModelTarget_gen2x = (Spinner) mCurrentView.findViewById(R.id.sp_model_target_gen2x);

        tvMultipleMultiple.setOnClickListener(this);
        tvMultipleWhole.setOnClickListener(this);
        tvSingleDistance.setOnClickListener(this);
        tvSingleMulti.setOnClickListener(this);
        tvCustom.setOnClickListener(this);

        swMultipleMultiple.setOnCheckedChangeListener(this);
        swMultipleWhole.setOnCheckedChangeListener(this);
        swSingleDistance.setOnCheckedChangeListener(this);
        swSingleMulti.setOnCheckedChangeListener(this);
        swCustom.setOnCheckedChangeListener(this);
        swMultipleMultiple_gen2x.setOnCheckedChangeListener(this);
        swMultipleWhole_gen2x.setOnCheckedChangeListener(this);
        swSingleDistance_gen2x.setOnCheckedChangeListener(this);
        swSingleMulti_gen2x.setOnCheckedChangeListener(this);
        swCustom_gen2x.setOnCheckedChangeListener(this);

        mode1_power = (TextView) mCurrentView.findViewById(R.id.mode1_power);
        mode2_power = (TextView) mCurrentView.findViewById(R.id.mode2_power);
        mode3_power = (TextView) mCurrentView.findViewById(R.id.mode3_power);
        mode4_power = (TextView) mCurrentView.findViewById(R.id.mode4_power);
        mode1_profile = (TextView) mCurrentView.findViewById(R.id.mode1_profile);
        mode2_profile = (TextView) mCurrentView.findViewById(R.id.mode2_profile);
        mode3_profile = (TextView) mCurrentView.findViewById(R.id.mode3_profile);
        mode4_profile = (TextView) mCurrentView.findViewById(R.id.mode4_profile);

        if (DisplayUtil.getUhfPad().equals("E710-US") || DisplayUtil.getUhfPad().contains("E510")|| DisplayUtil.getUhfPad().equals("TM600-C")) {
            mode1_power.setText("30dBm");
            mode2_power.setText("30dBm");
            mode3_power.setText("30dBm");
        }
        if(rb_gen2x_template.isChecked()){
            ll_gen2x_function.setVisibility(View.VISIBLE);
                setGen2xDisplay();
        }
        llModel.setVisibility(View.VISIBLE);
        refreshModelUI();
        initModelAdapter();

        setStandardDisplay();
    }

    private void initModelAdapter() {

        initAdapter(getResources().getStringArray(R.array.arraySession), spModelSession, MODEL_SESSION, mConfig.getValue(MODEL_SESSION, TEMPLATE3));
        initAdapter(getResources().getStringArray(R.array.arraySession), spModelSession_gen2x, MODEL_SESSION_GEN2X, mConfig.getValue(MODEL_SESSION_GEN2X, TEMPLATE3));

        //profile定义选项和值
        if(rb_gen2x_template.isChecked()){
            if(DisplayUtil.isOnGMS() && DisplayUtil.getUhfPad().equals("E510")) {
                profile_options = new String[]{"P10", "P11", "P12", "P13","P22"};
                profile_values = new int[]{10, 11, 12, 13, 22};
            }else if(DisplayUtil.isOnGMS() && DisplayUtil.getUhfPad().equals("E710")) {
                profile_options = new String[]{"P10", "P11", "P12", "P13", "P22", "P23", "P24", "P25", "P27","P32","P33", "P34", "P35", "P36"};
                profile_values = new int[]{10, 11, 12, 13, 22, 23, 24, 25, 27, 32, 33, 34, 35, 36};
            }else if(DisplayUtil.getUhfPad().contains("E510")) {
                profile_options = new String[]{"P10", "P11", "P12", "P13","P18"};
                profile_values = new int[]{10, 11, 12, 13, 18};
            }else if(DisplayUtil.getUhfPad().contains("E710")) {
                profile_options = new String[]{"P10", "P11", "P12", "P13","P18", "P19", "P20", "P21", "P27","P28", "P29", "P30","P31","P36"};
                profile_values = new int[]{10, 11, 12, 13, 18, 19, 20, 21, 27, 28,29, 30, 31, 36};
            }else {
                profile_options = new String[]{"P0", "P1", "P2", "P3"};
                profile_values = new int[]{0, 1, 2, 3};
            }
            initAdapter(profile_options, spModelProfile_gen2x, MODEL_PROFILE_GEN2X, mConfig.getValue(MODEL_PROFILE_GEN2X, TEMPLATE2));
        }else {
            if (DisplayUtil.isOnGMS() && DisplayUtil.getUhfPad().equals("E710")) {
                profile_options = new String[]{"P5", "P6", "P7", "P8", "P9", "P16", "P17"};
                profile_values = new int[]{5, 6, 7, 8, 9, 16, 17};
            } else if (DisplayUtil.isOnGMS() && DisplayUtil.getUhfPad().equals("E510")){
                profile_options = new String[]{"P5", "P6", "P7", "P8", "P17"};
                profile_values = new int[]{5, 6, 7, 8, 17};
            }else if (DisplayUtil.getUhfPad().contains("E710")) {
                profile_options = new String[]{"P0", "P1", "P2", "P3", "P4", "P14", "P15"};
                profile_values = new int[]{0, 1, 2, 3, 4, 14, 15};
            }else if (DisplayUtil.getUhfPad().contains("E510")) {
                profile_options = new String[]{"P0", "P1", "P3", "P4", "P15"};
                profile_values = new int[]{0, 1, 3, 4, 15};
            }else {
                profile_options = new String[]{"P0", "P1", "P2", "P3"};
                profile_values = new int[]{0, 1, 2, 3};
            }
            initAdapter(profile_options, spModelProfile, MODEL_PROFILE, mConfig.getValue(MODEL_PROFILE, TEMPLATE2));
        }

        if (DisplayUtil.getUhfPad().contains("E510") || DisplayUtil.getUhfPad().equals("TM600-C")){
            initAdapter(getResources().getStringArray(R.array.arrayPower30), spModelPower, MODEL_POWER, mConfig.getValue(MODEL_POWER, 29));
            initAdapter(getResources().getStringArray(R.array.arrayPower30), spModelPower_gen2x, MODEL_POWER_GEN2X, mConfig.getValue(MODEL_POWER_GEN2X, 29));
        }else{
            initAdapter(getResources().getStringArray(R.array.arrayPower), spModelPower, MODEL_POWER, mConfig.getValue(MODEL_POWER, 32));
            initAdapter(getResources().getStringArray(R.array.arrayPower), spModelPower_gen2x, MODEL_POWER_GEN2X, mConfig.getValue(MODEL_POWER_GEN2X, 32));
        }
        String[] target = mContext.getResources().getStringArray(R.array.model_target);
        initAdapter(target, spModelTarget, MODEL_TARGET, mConfig.getValue(MODEL_TARGET, TEMPLATE1));
        initAdapter(target, spModelTarget_gen2x, MODEL_TARGET_GEN2X, mConfig.getValue(MODEL_TARGET_GEN2X, TEMPLATE1));


        int showModel = mConfig.getValue(DEFAULT_MODEL, TEMPLATE0);
        displayPower(false);
        switch (showModel){
            case TEMPLATE1:
                swMultipleMultiple.setChecked(true);
                setItemShow(TEMPLATE1);
                break;
            case TEMPLATE2:
                swMultipleWhole.setChecked(true);
                setItemShow(TEMPLATE2);
                break;
            case TEMPLATE3:
                swSingleDistance.setChecked(true);
                setItemShow(TEMPLATE3);
                break;
            case TEMPLATE4:
                swSingleMulti.setChecked(true);
                setItemShow(TEMPLATE4);
                break;
            case TEMPLATE5:
                setEnable(false);
                setEnable_gen2x(true);
                swCustom.setChecked(true);
                setItemShow(TEMPLATE5);
                break;
            case TEMPLATE6:
                swMultipleMultiple_gen2x.setChecked(true);
                setItemShow(TEMPLATE1);
                break;
            case TEMPLATE7:
                swMultipleWhole_gen2x.setChecked(true);
                setItemShow(TEMPLATE2);
                break;
            case TEMPLATE8:
                swSingleDistance_gen2x.setChecked(true);
                setItemShow(TEMPLATE3);
                break;
            case TEMPLATE9:
                swSingleMulti_gen2x.setChecked(true);
                setItemShow(TEMPLATE4);
                break;
            case TEMPLATE10:
                setEnable_gen2x(false);
                setEnable(true);
                swCustom_gen2x.setChecked(true);
                setItemShow(TEMPLATE10);
                break;
            default:
                setEnable(false);
                setEnable_gen2x(true);
                swCustom.setChecked(true);
                handleUpload(TEMPLATE5);
                mConfig.setValue(DEFAULT_MODEL, TEMPLATE5);
                setItemShow(TEMPLATE5);
                displayPower(true);
                break;
        }
        if(showModel == TEMPLATE5 || showModel == TEMPLATE10)
            displayPower(true);
    }

    private void displayPower(boolean value){
        sp_power.setEnabled(value);
        btn_setpower.setEnabled(value);
        btn_getpower.setEnabled(value);
    }

    private void initAdapter(String[] data, Spinner spModel, final String value, int defaultValue) {
        MySpinnerAdapter sessionAdapter = new MySpinnerAdapter(mContext, android.R.layout.simple_list_item_1, data);
        spModel.setAdapter(sessionAdapter);
        spModel.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> adapterView, View view, int position, long l) {
                if(value.equals(MODEL_SESSION)){
                    if(position == 0){
                        String[] target = mContext.getResources().getStringArray(R.array.model_target);
                        initAdapter(target, spModelTarget, MODEL_TARGET, mConfig.getValue(MODEL_TARGET, TEMPLATE1));
                    }else{
                        String[] target = mContext.getResources().getStringArray(R.array.model_target2);
                        initAdapter(target, spModelTarget, MODEL_TARGET, mConfig.getValue(MODEL_TARGET, TEMPLATE1)>1?0:mConfig.getValue(MODEL_TARGET, TEMPLATE1));
                    }
                }
                mConfig.setValue(value, position);
            }

            @Override
            public void onNothingSelected(AdapterView<?> adapterView) {
            }
        });
        spModel.setSelection(defaultValue);
    }

    private void refreshModelUI() {
        tvMultipleMultiple.setText(mContext.getResources().getString(R.string.multiple_multiple));
        tvMultipleWhole.setText(mContext.getResources().getString(R.string.multiple_whole));
        tvSingleDistance.setText(mContext.getResources().getString(R.string.single_distance));
        tvSingleMulti.setText(mContext.getResources().getString(R.string.single_multi));
        tvCustom.setText(mContext.getResources().getString(R.string.custom));
        tvMultipleMultiple_1.setText(mContext.getResources().getString(R.string.multiple_multiple_1));
        tvMultipleWhole_1.setText(mContext.getResources().getString(R.string.multiple_whole_1));
        tvSingleDistance_1.setText(mContext.getResources().getString(R.string.single_distance_1));
        tvSingleMulti_1.setText(mContext.getResources().getString(R.string.single_multi_1));

        String[] switchText = mContext.getResources().getStringArray(R.array.bfswitchString);
        swMultipleMultiple.setTextOff(switchText[0]);
        swMultipleMultiple.setTextOn(switchText[1]);
        requestLayout(swMultipleMultiple);
        swMultipleMultiple_gen2x.setTextOff(switchText[0]);
        swMultipleMultiple_gen2x.setTextOn(switchText[1]);
        requestLayout(swMultipleMultiple_gen2x);

        swMultipleWhole.setTextOff(switchText[0]);
        swMultipleWhole.setTextOn(switchText[1]);
        requestLayout(swMultipleWhole);
        swMultipleWhole_gen2x.setTextOff(switchText[0]);
        swMultipleWhole_gen2x.setTextOn(switchText[1]);
        requestLayout(swMultipleWhole_gen2x);

        swSingleDistance.setTextOff(switchText[0]);
        swSingleDistance.setTextOn(switchText[1]);
        requestLayout(swSingleDistance);
        swSingleDistance_gen2x.setTextOff(switchText[0]);
        swSingleDistance_gen2x.setTextOn(switchText[1]);
        requestLayout(swSingleDistance_gen2x);

        swSingleMulti.setTextOff(switchText[0]);
        swSingleMulti.setTextOn(switchText[1]);
        requestLayout(swSingleMulti);
        swSingleMulti_gen2x.setTextOff(switchText[0]);
        swSingleMulti_gen2x.setTextOn(switchText[1]);
        requestLayout(swSingleMulti_gen2x);

        swCustom.setTextOff(switchText[0]);
        swCustom.setTextOn(switchText[1]);
        requestLayout(swCustom);
        swCustom_gen2x.setTextOff(switchText[0]);
        swCustom_gen2x.setTextOn(switchText[1]);
        requestLayout(swCustom_gen2x);
    }

    private void requestLayout(Switch switchObj) {
        try {
            java.lang.reflect.Field mOnLayout = Switch.class.getDeclaredField("mOnLayout");
            mOnLayout.setAccessible(true);
            mOnLayout.set(switchObj, null);
            java.lang.reflect.Field mOffLayout = Switch.class.getDeclaredField("mOffLayout");
            mOffLayout.setAccessible(true);
            mOffLayout.set(switchObj, null);
        } catch (Exception x) {

        }
        switchObj.requestLayout();
    }

    private void handleUpload(int groupPosition) {
        int setPower = 33;
        if (DisplayUtil.getUhfPad().equals("E710-US") || DisplayUtil.getUhfPad().contains("E510")|| DisplayUtil.getUhfPad().equals("TM600-C")) {
            setPower = 30;
        }
        int setSession = TEMPLATE1;
        int setProfile = TEMPLATE1;
        int setTarget = TEMPLATE1;
        switch (groupPosition) {
            case TEMPLATE1:
                setSession = TEMPLATE3;
                setProfile = mMode1_profile;
                displayPower(false);
                break;
            case TEMPLATE2:
                setSession = TEMPLATE2;
                setProfile = mMode2_profile;
                displayPower(false);
                break;
            case TEMPLATE3:
                displayPower(false);
                setProfile = mMode3_profile;
                break;
            case TEMPLATE4:
                setPower = 24;
                setProfile = mMode4_profile;
                setTarget = TEMPLATE3;
                displayPower(false);
                break;
            case TEMPLATE5:
                setPower = mConfig.getValue(MODEL_POWER, 32) + 1;
                setSession = mConfig.getValue(MODEL_SESSION, TEMPLATE3);
                setTarget = mConfig.getValue(MODEL_TARGET, TEMPLATE1);
                Log.i(TAG, "Profile ="+mConfig.getValue(MODEL_PROFILE, TEMPLATE2));
                setProfile = positionToValue_P(mConfig.getValue(MODEL_PROFILE, TEMPLATE2));
                Log.i(TAG, "setProfile ="+setProfile);
                displayPower(true);
                break;
            case TEMPLATE10:
                setPower = mConfig.getValue(MODEL_POWER_GEN2X, 32) + 1;
                setSession = mConfig.getValue(MODEL_SESSION_GEN2X, TEMPLATE3);
                setTarget = mConfig.getValue(MODEL_TARGET_GEN2X, TEMPLATE1);
                Log.i(TAG, "Profile ="+mConfig.getValue(MODEL_PROFILE_GEN2X, TEMPLATE2));
                setProfile = positionToValue_P(mConfig.getValue(MODEL_PROFILE_GEN2X, TEMPLATE2));
                Log.i(TAG, "setProfile ="+setProfile);
                displayPower(true);
                break;
        }

        if (setTagParam(setPower, setSession, setProfile, setTarget))
            ToastUtils.showToast(mContext, getString(R.string.set_success));
        else
            ToastUtils.showToast(mContext, getString(R.string.set_fail));
    }

    public void setRegionAdapter() {
        if ((DisplayUtil.getUhfPad().equals("E710")||DisplayUtil.getUhfPad().equals("E510")) && DisplayUtil.isOnGMS()) {
            region_adapter = new ArrayAdapter<String>(mContext, android.R.layout.simple_spinner_item, getResources().getStringArray(R.array.ETSIRegion));
        } else if (DisplayUtil.getUhfPad().contains("-EU") || DisplayUtil.isGMS()) {
            region_adapter = new ArrayAdapter<String>(mContext, android.R.layout.simple_spinner_item, getResources().getStringArray(R.array.ETSIRegion));
        } else {
            region_adapter = new ArrayAdapter<String>(mContext, android.R.layout.simple_spinner_item, getResources().getStringArray(R.array.arrayRegion));
        }
        region_adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        sp_region.setAdapter(region_adapter);

        if (DisplayUtil.getUhfPad().contains("E510")|| DisplayUtil.getUhfPad().equals("TM600-C")){
            power_adapter = new ArrayAdapter<String>(mContext, android.R.layout.simple_spinner_item, getResources().getStringArray(R.array.arrayPower30));
        }else{
            power_adapter = new ArrayAdapter<String>(mContext, android.R.layout.simple_spinner_item, getResources().getStringArray(R.array.arrayPower));
        }
        power_adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        sp_power.setAdapter(power_adapter);
    }

    public class OnMyCheckedChangedListener implements CompoundButton.OnCheckedChangeListener {
        @Override
        public void onCheckedChanged(CompoundButton buttonView, boolean isChecked) {
            switch (buttonView.getId()) {
                case R.id.cb_soundRepeat:
                    if (isChecked)
                        mAppconfig.set("soundRepeat", 1);
                    else
                        mAppconfig.set("soundRepeat", 0);
                    break;
                case R.id.cb_clearStart:
                    if (isChecked) {
                        mService.setParameters(UHFService.PARAMETER_CLEAR_EPCLIST_WHEN_START_INVENTORY, 1);
                        mConfig.setValue("PARAMETER_CLEAR_EPCLIST_WHEN_START_INVENTORY", 1);
                    } else {
                        mService.setParameters(UHFService.PARAMETER_CLEAR_EPCLIST_WHEN_START_INVENTORY, 0);
                        mConfig.setValue("PARAMETER_CLEAR_EPCLIST_WHEN_START_INVENTORY", 0);
                    }
                    break;
                case R.id.cb_tidSort:
                    if (isChecked)
                        mAppconfig.set("tidSort", 1);
                    else
                        mAppconfig.set("tidSort", 0);
                    break;
                case R.id.cb_algorithm_6C:
                    if (isChecked) {
                        mService.setParameters(34, 1);
                        mConfig.setValue("PARAMETER_S2_ALGORITHM", 1);
                    } else {
                        mService.setParameters(34, 0);
                        mConfig.setValue("PARAMETER_S2_ALGORITHM", 0);
                    }
                    break;
                case R.id.cb_export:
                    int export = 0;
                    if (cb_export.isChecked())
                        export = 1;
                    mAppconfig.set("export", export);
                    break;
            }
        }
    }

    @Override
    public void onClick(View v) {
        switch (v.getId()) {
            case R.id.rb_standard_template:
                ll_gen2x_function.setVisibility(View.GONE);
                llCustom_gen2x.setVisibility(View.GONE);
                llCustom_standard.setVisibility(View.VISIBLE);
                setStandardDisplay();
                initModelAdapter();
                break;
            case R.id.rb_gen2x_template:
                ll_gen2x_function.setVisibility(View.VISIBLE);
                llCustom_gen2x.setVisibility(View.VISIBLE);
                llCustom_standard.setVisibility(View.GONE);
                setGen2xDisplay();
                initModelAdapter();
                break;
            case R.id.btn_setpower:
                int power = sp_power.getSelectedItemPosition() + 1;
                if (!mConfig.setPower(power)) {
                    ToastUtils.showToast(mContext, getString(R.string.power_write_fail));
                } else {
                    mConfig.setValue("power", power);
                    mConfig.setValue(MODEL_POWER, sp_power.getSelectedItemPosition());
                    mConfig.setValue(MODEL_POWER_GEN2X, sp_power.getSelectedItemPosition());
                    spModelPower.setSelection(sp_power.getSelectedItemPosition());
                    spModelPower_gen2x.setSelection(sp_power.getSelectedItemPosition());
                    ToastUtils.showToast(mContext, getString(R.string.power_write_success));
                }
                break;
            case R.id.btn_getpower:
                int getpower = mService.getPower();
                if (getpower > 0 && getpower < 34) {
                    sp_power.setSelection(getpower - 1);
                } else {
                    ToastUtils.showToast(mContext, getString(R.string.get_fail));
                }
                break;
            case R.id.btn_setregion:
                String str_region = null;
                int setregion = sp_region.getSelectedItemPosition();
                if ((DisplayUtil.getUhfPad().equals("E710")||DisplayUtil.getUhfPad().equals("E510")) && DisplayUtil.isOnGMS()) {
                    if (setregion == 0)
                        str_region = "ETSI";
                } else if (DisplayUtil.getUhfPad().contains("-EU") || DisplayUtil.isGMS()) {
                    if (setregion == 0)
                        str_region = "ETSI";
                } else {
                    if (setregion == 0)
                        str_region = "FCC";
                    else if (setregion == 1)
                        str_region = "China1";
                }
                if (mService.setRegion(str_region)) {
                    mAppconfig.set("region", str_region);
                    ToastUtils.showToast(mContext, getString(R.string.set_success));
                } else
                    ToastUtils.showToast(mContext, getString(R.string.set_fail));
                break;
            case R.id.btn_getregion:
                String getregion = mService.getRegion();
                if (getregion != null) {
                    if (getregion.equalsIgnoreCase("FCC"))
                        sp_region.setSelection(0);
                    else if (getregion.equalsIgnoreCase("China1"))
                        sp_region.setSelection(1);
                    else if (getregion.equalsIgnoreCase("ETSI"))
                        break;
                } else
                    ToastUtils.showToast(mContext, getString(R.string.get_fail));
                break;
            case R.id.btn_setprotocol:
                int setprotocol = sp_protocol.getSelectedItemPosition();
                if (!mConfig.setParameters(21, setprotocol)) {
                    ToastUtils.showToast(mContext, getString(R.string.set_success));
                } else {
                    ToastUtils.showToast(mContext, getString(R.string.set_success));
                }
                break;
            case R.id.btn_getprotocol:
                break;
            case R.id.btn_gettemperature:
                et_temperature.setText(mService.getTemperature());
                break;
            case R.id.btn_settag:
                if (setTagParam())
                    ToastUtils.showToast(mContext, getString(R.string.set_success));
                else
                    ToastUtils.showToast(mContext, getString(R.string.set_fail));
                break;
            case R.id.btn_gettag:
                getTagParam();
                break;

            case R.id.rb_embeded_password:
                mBankIndex = 0;
                et_embeded_length.setText("8");
                break;
            case R.id.rb_embeded_tid:
                mBankIndex = 2;
                et_embeded_length.setText("12");
                break;

            case R.id.rb_embeded_user:
                mBankIndex = 3;
                break;
            case R.id.btn_setembeded:
                if ((TextUtils.isEmpty(et_embeded_address.getText())) || (TextUtils.isEmpty(et_embeded_length.getText()))
                        || (TextUtils.isEmpty(et_embeded_acpwd.getText())) || et_embeded_acpwd.getText().toString().length() != 8) {
                    Toast.makeText(mContext, mContext.getResources().getString(R.string.parameterisnot_correct), Toast.LENGTH_SHORT).show();
                    break;
                }
                if (Integer.parseInt(et_embeded_address.getText().toString()) % 2 != 0 || Integer.parseInt(et_embeded_length.getText().toString()) % 2 != 0) {
                    Toast.makeText(mContext, mContext.getResources().getString(R.string.parameterisnot_correct), Toast.LENGTH_SHORT).show();
                    break;
                }
                if (cb_embeded.isChecked()) {
                    byte[] embd = new byte[255];
                    embd[0] = (byte) mBankIndex;
                    embd[1] = (byte) Integer.parseInt(et_embeded_address.getText().toString());
                    embd[2] = (byte) Integer.parseInt(et_embeded_length.getText().toString());
                    System.arraycopy(BaseUtil.getHexByteArray(et_embeded_acpwd.getText().toString()), 0, embd, 3, 4);
                    if (mService.setParamBytes(UHFService.PARAMETER_TAG_EMBEDEDDATA, embd)) {
                        mAppconfig.set("isEmbeded", true);
                        mAppconfig.set("embededBank", mBankIndex);
                        mAppconfig.set("embededAddress", Integer.parseInt(et_embeded_address.getText().toString()));
                        mAppconfig.set("embededLenth", Integer.parseInt(et_embeded_length.getText().toString()));
                        mAppconfig.set("embededPwd", et_embeded_acpwd.getText().toString());
                        ToastUtils.showToast(mContext, getString(R.string.set_success));
                        cb_tidSort.setEnabled(true);
                    } else
                        ToastUtils.showToast(mContext, getString(R.string.set_fail));
                } else {
                    mAppconfig.set("isEmbeded", false);
                    if (mService.setParamBytes(UHFService.PARAMETER_TAG_EMBEDEDDATA, null)) {
                        ToastUtils.showToast(mContext, getString(R.string.set_success));
                        cb_tidSort.setChecked(false);
                        cb_tidSort.setEnabled(false);
                    } else
                        ToastUtils.showToast(mContext, getString(R.string.set_fail));
                }
                break;
            case R.id.tv_multiple_multiple:
                if (!isMulCheck) {
                    setItemShow(TEMPLATE1);
                } else {
                    setItemShow(TEMPLATE0);
                }
                break;
            case R.id.tv_multiple_whole:
                if (!isModelWholeCheck) {
                    setItemShow(TEMPLATE2);
                } else {
                    setItemShow(TEMPLATE0);
                }
                break;
            case R.id.tv_single_distance:
                if (!isDistanceCheck) {
                    setItemShow(TEMPLATE3);
                } else {
                    setItemShow(TEMPLATE0);
                }
                break;
            case R.id.tv_single_multi:
                if (!isMoreCheck) {
                    setItemShow(TEMPLATE4);
                } else {
                    setItemShow(TEMPLATE0);
                }
                break;
            case R.id.tv_custom:
                if (!isCustomCheck) {
                    if(rb_gen2x_template.isChecked())
                        setItemShow(TEMPLATE10);
                    else
                        setItemShow(TEMPLATE5);
                } else {
                    setItemShow(TEMPLATE0);
                }
                break;
        }
    }

    private void setItemShow(int item) {
        llMul.setVisibility(View.GONE);
        llModelWhole.setVisibility(View.GONE);
        llDistance.setVisibility(View.GONE);
        llMore.setVisibility(View.GONE);
        llCustom.setVisibility(View.GONE);
        switch (item) {
            case TEMPLATE1:
                llMul.setVisibility(View.VISIBLE);
                setClickShow(TEMPLATE1);
                break;
            case TEMPLATE2:
                llModelWhole.setVisibility(View.VISIBLE);
                setClickShow(TEMPLATE2);
                break;
            case TEMPLATE3:
                llDistance.setVisibility(View.VISIBLE);
                setClickShow(TEMPLATE3);
                break;
            case TEMPLATE4:
                llMore.setVisibility(View.VISIBLE);
                setClickShow(TEMPLATE4);
                break;
            case TEMPLATE5:
                llCustom.setVisibility(View.VISIBLE);
                setClickShow(TEMPLATE5);
                break;
            case TEMPLATE10:
                llCustom.setVisibility(View.VISIBLE);
                setClickShow(TEMPLATE5);
                break;
            default:
                setClickShow(TEMPLATE0);
                break;
        }
    }

    private void setClickShow(int template) {
        isMulCheck = false;
        isModelWholeCheck = false;
        isDistanceCheck = false;
        isMoreCheck = false;
        isCustomCheck = false;
        if (template == TEMPLATE1) {
            isMulCheck = true;
        } else if (template == TEMPLATE2) {
            isModelWholeCheck = true;
        } else if (template == TEMPLATE3) {
            isDistanceCheck = true;
        } else if (template == TEMPLATE4) {
            isMoreCheck = true;
        } else if (template == TEMPLATE5) {
            isCustomCheck = true;
        }
    }

    @Override
    public void onCheckedChanged(CompoundButton buttonView, boolean isCheck) {
        if (!buttonView.isPressed()) {
            return;
        }
        switch (buttonView.getId()) {
            case R.id.sw_multiple_multiple:
                if (isCheck) {
                    setCheck(TEMPLATE1);
                    handleUpload(TEMPLATE1);
                    mConfig.setValue(DEFAULT_MODEL, TEMPLATE1);
                    int power = mService.getPower();
                    sp_power.setSelection(power - 1);
                }
                setItemShow(TEMPLATE1);
                break;
            case R.id.sw_multiple_multiple_gen2x:
                if (isCheck) {
                    setCheck(TEMPLATE6);
                    mConfig.setValue(DEFAULT_MODEL, TEMPLATE6);
                    handleUpload(TEMPLATE1);
                    int power = mService.getPower();
                    sp_power.setSelection(power - 1);
                }
                setItemShow(TEMPLATE1);
                break;
            case R.id.sw_multiple_whole:
                if (isCheck) {
                    setCheck(TEMPLATE2);
                    handleUpload(TEMPLATE2);
                    mConfig.setValue(DEFAULT_MODEL, TEMPLATE2);
                    int power = mService.getPower();
                    sp_power.setSelection(power - 1);
                }
                setItemShow(TEMPLATE2);
                break;
            case R.id.sw_multiple_whole_gen2x:
                if (isCheck) {
                    setCheck(TEMPLATE7);
                    mConfig.setValue(DEFAULT_MODEL, TEMPLATE7);
                    handleUpload(TEMPLATE2);
                    int power = mService.getPower();
                    sp_power.setSelection(power - 1);
                }
                setItemShow(TEMPLATE2);
                break;
            case R.id.sw_single_distance:
                if (isCheck) {
                    setCheck(TEMPLATE3);
                    handleUpload(TEMPLATE3);
                    mConfig.setValue(DEFAULT_MODEL, TEMPLATE3);
                    int power = mService.getPower();
                    sp_power.setSelection(power - 1);
                }
                setItemShow(TEMPLATE3);
                break;
            case R.id.sw_single_distance_gen2x:
                if (isCheck) {
                    setCheck(TEMPLATE8);
                    mConfig.setValue(DEFAULT_MODEL, TEMPLATE8);
                    handleUpload(TEMPLATE3);
                    int power = mService.getPower();
                    sp_power.setSelection(power - 1);
                }
                setItemShow(TEMPLATE3);
                break;
            case R.id.sw_single_multi:
                if (isCheck) {
                    setCheck(TEMPLATE4);
                    handleUpload(TEMPLATE4);
                    mConfig.setValue(DEFAULT_MODEL, TEMPLATE4);
                    int power = mService.getPower();
                    sp_power.setSelection(power - 1);
                }
                setItemShow(TEMPLATE4);
                break;
            case R.id.sw_single_multi_gen2x:
                if (isCheck) {
                    setCheck(TEMPLATE9);
                    mConfig.setValue(DEFAULT_MODEL, TEMPLATE9);
                    handleUpload(TEMPLATE4);
                    int power = mService.getPower();
                    sp_power.setSelection(power - 1);
                }
                setItemShow(TEMPLATE4);
                break;
            case R.id.sw_custom:
                if (isCheck) {
                    setCheck(TEMPLATE5);
                    handleUpload(TEMPLATE5);
                    mConfig.setValue(DEFAULT_MODEL, TEMPLATE5);
                    int power = mService.getPower();
                    sp_power.setSelection(power - 1);
                } else {
                    setEnable(true);
                }
                setItemShow(TEMPLATE5);
                break;
            case R.id.sw_custom_gen2x:
                if (isCheck) {
                    setCheck(TEMPLATE10);
                    mConfig.setValue(DEFAULT_MODEL, TEMPLATE10);
                    handleUpload(TEMPLATE10);
                    int power = mService.getPower();
                    sp_power.setSelection(power - 1);
                } else {
                    setEnable_gen2x(true);
                }
                setItemShow(TEMPLATE5);
                break;
            default:
                break;
        }
    }

    private void setEnable(boolean isShow) {
        spModelSession.setEnabled(isShow);
        spModelPower.setEnabled(isShow);
        spModelProfile.setEnabled(isShow);
        spModelTarget.setEnabled(isShow);
    }
    private void setEnable_gen2x(boolean isShow) {
        spModelSession_gen2x.setEnabled(isShow);
        spModelPower_gen2x.setEnabled(isShow);
        spModelProfile_gen2x.setEnabled(isShow);
        spModelTarget_gen2x.setEnabled(isShow);
    }

    private void setCheck(int check) {
        swMultipleMultiple.setChecked(false);
        swMultipleWhole.setChecked(false);
        swSingleDistance.setChecked(false);
        swSingleMulti.setChecked(false);
        swCustom.setChecked(false);
        swMultipleMultiple_gen2x.setChecked(false);
        swMultipleWhole_gen2x.setChecked(false);
        swSingleDistance_gen2x.setChecked(false);
        swSingleMulti_gen2x.setChecked(false);
        swCustom_gen2x.setChecked(false);
        setEnable(true);
        switch (check) {
            case TEMPLATE1:
                swMultipleMultiple.setChecked(true);
                setClickShow(TEMPLATE1);
                break;
            case TEMPLATE2:
                swMultipleWhole.setChecked(true);
                setClickShow(TEMPLATE2);
                break;
            case TEMPLATE3:
                swSingleDistance.setChecked(true);
                setClickShow(TEMPLATE3);
                break;
            case TEMPLATE4:
                swSingleMulti.setChecked(true);
                setClickShow(TEMPLATE4);
                break;
            case TEMPLATE5:
                swCustom.setChecked(true);
                setClickShow(TEMPLATE5);
                setEnable(false);
                setEnable_gen2x(true);
                break;
            case TEMPLATE6:
                swMultipleMultiple_gen2x.setChecked(true);
                setClickShow(TEMPLATE1);
                break;
            case TEMPLATE7:
                swMultipleWhole_gen2x.setChecked(true);
                setClickShow(TEMPLATE2);
                break;
            case TEMPLATE8:
                swSingleDistance_gen2x.setChecked(true);
                setClickShow(TEMPLATE3);
                break;
            case TEMPLATE9:
                swSingleMulti_gen2x.setChecked(true);
                setClickShow(TEMPLATE4);
                break;
            case TEMPLATE10:
                swCustom_gen2x.setChecked(true);
                setClickShow(TEMPLATE5);
                setEnable_gen2x(false);
                setEnable(true);
                break;
        }
    }

    private boolean setTagParam(int setPower, int setSession, int setProfile, int setTarget) {
        if (!mConfig.setPower(setPower)) {
            return false;
        }
        mConfig.setValue("power", setPower);

        if (!mService.setParameters(UHFService.PARAMETER_INVENTORY_SESSION, setSession))
            return false;
        mConfig.setValue("PARAMETER_INVENTORY_SESSION", setSession);

        mService.setParameters(UHFService.PARAMETER_LINK_PROFILE, setProfile);
        mConfig.setValue("PARAMETER_LINK_PROFILE", setProfile);

        mService.setParameters(UHFService.PARAMETER_INVENTORY_SESSION_TARGET, setTarget);
        mConfig.setValue("PARAMETER_INVENTORY_SESSION_TARGET", setTarget);
        return true;
    }

    private boolean setTagParam() {
        int settagfocus = 0;
        if (cb_tagfocus.isChecked())
            settagfocus = 1;
        mService.setParameters(UHFService.PARAMETER_EXTENSIONS_TAGFOCUS, settagfocus);
        mConfig.setValue("PARAMETER_EXTENSIONS_TAGFOCUS", settagfocus);

        int setfastid = 0;
        if (cb_fastid.isChecked())
            setfastid = 1;
        mService.setParameters(UHFService.PARAMETER_EXTENSIONS_FASTID, setfastid);
        mConfig.setValue("PARAMETER_EXTENSIONS_FASTID", setfastid);

        return true;
    }

    private void getTagParam() {
        int getTagFocus = mConfig.getValue("PARAMETER_EXTENSIONS_TAGFOCUS", 0);
        cb_tagfocus.setChecked(getTagFocus == 1);

        int getFastId = mConfig.getValue("PARAMETER_EXTENSIONS_FASTID", 0);
        cb_fastid.setChecked(getFastId == 1);
        cb_export.setChecked(mAppconfig.export == 1);
        cb_soundRepeat.setChecked(mAppconfig.soundRepeat == 1);
        cb_tidSort.setChecked(mAppconfig.tidSort == 1);

        int clearStart = mConfig.getValue("PARAMETER_CLEAR_EPCLIST_WHEN_START_INVENTORY", 1);
        cb_clearStart.setChecked(clearStart == 1);
        int enableS2algorithm = mConfig.getValue("PARAMETER_S2_ALGORITHM", 0);
        cb_algorithm_6C.setChecked(enableS2algorithm == 1);
    }

    private void setGen2xDisplay() {
        swMultipleMultiple.setVisibility(View.GONE);
        swMultipleWhole.setVisibility(View.GONE);
        swSingleDistance.setVisibility(View.GONE);
        swSingleMulti.setVisibility(View.GONE);
        swCustom.setVisibility(View.GONE);
        swMultipleMultiple_gen2x.setVisibility(View.VISIBLE);
        swMultipleWhole_gen2x.setVisibility(View.VISIBLE);
        swSingleDistance_gen2x.setVisibility(View.VISIBLE);
        swSingleMulti_gen2x.setVisibility(View.VISIBLE);
        swCustom_gen2x.setVisibility(View.VISIBLE);
        mode1_profile.setText("P1");
        mode2_profile.setText("P1");
        mode3_profile.setText("P0");
        mode4_profile.setText("P2");
        mMode1_profile = 1;
        mMode2_profile = 1;
        mMode3_profile = 0;
        mMode4_profile = 2;
        if(DisplayUtil.getUhfPad().contains("E510")) {
            mode1_profile.setText("P12");
            mode2_profile.setText("P12");
            mode3_profile.setText("P10");
            mode4_profile.setText("P13");
            mMode1_profile = 12;
            mMode2_profile = 12;
            mMode3_profile = 10;
            mMode4_profile = 13;
        }else if(DisplayUtil.getUhfPad().contains("E710")){
            mode1_profile.setText("P36");
            mode2_profile.setText("P12");
            mode3_profile.setText("P28");
            mode4_profile.setText("P13");
            mMode1_profile = 36;
            mMode2_profile = 12;
            mMode3_profile = 28;
            mMode4_profile = 13;
            if(DisplayUtil.isOnGMS() && DisplayUtil.getUhfPad().equals("E710")){
                mode3_profile.setText("P32");
                mMode3_profile = 32;
            }
        }
    }

    private void setStandardDisplay() {
        swMultipleMultiple.setVisibility(View.VISIBLE);
        swMultipleWhole.setVisibility(View.VISIBLE);
        swSingleDistance.setVisibility(View.VISIBLE);
        swSingleMulti.setVisibility(View.VISIBLE);
        swCustom.setVisibility(View.VISIBLE);
        swMultipleMultiple_gen2x.setVisibility(View.GONE);
        swMultipleWhole_gen2x.setVisibility(View.GONE);
        swSingleDistance_gen2x.setVisibility(View.GONE);
        swSingleMulti_gen2x.setVisibility(View.GONE);
        swCustom_gen2x.setVisibility(View.GONE);
        mode1_profile.setText("P1");
        mode2_profile.setText("P1");
        mode3_profile.setText("P0");
        mode4_profile.setText("P2");
        mMode1_profile = 1;
        mMode2_profile = 1;
        mMode3_profile = 0;
        mMode4_profile = 2;
        if(DisplayUtil.getUhfPad().contains("E510")){
            if(DisplayUtil.isOnGMS() && DisplayUtil.getUhfPad().equals("E510")) {
                mode1_profile.setText("P7");
                mode2_profile.setText("P7");
                mode3_profile.setText("P5");
                mode4_profile.setText("P8");
                mMode1_profile = 7;
                mMode2_profile = 7;
                mMode3_profile = 5;
                mMode4_profile = 8;
            }else{
                mode4_profile.setText("P4");
                mMode4_profile = 4;
            }
        }else if(DisplayUtil.isOnGMS() && DisplayUtil.getUhfPad().equals("E710")){
            mode1_profile.setText("P7");
            mode2_profile.setText("P7");
            mode3_profile.setText("P5");
            mode4_profile.setText("P9");
            mMode1_profile = 7;
            mMode2_profile = 7;
            mMode3_profile = 5;
            mMode4_profile = 9;
        }
    }
    private int positionToValue_P(int position){
        int value = 1;
        value = profile_values[position];
        return value;
    }

    @Override
    public void onHiddenChanged(boolean hidden) {
        if (!hidden) {
            AppCache.setScanEnable(false);
        }
    }
}
