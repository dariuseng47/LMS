package com.seuic.uhftool.activity;

import android.content.pm.PackageManager.NameNotFoundException;
import android.content.res.Configuration;
import android.os.Bundle;
import android.support.v4.app.Fragment;
import android.support.v4.app.FragmentActivity;
import android.support.v4.app.FragmentManager;
import android.support.v4.app.FragmentTransaction;
import android.view.Gravity;
import android.view.View;
import android.view.View.OnClickListener;
import android.widget.ImageButton;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.RadioGroup.OnCheckedChangeListener;
import android.widget.TextView;
import android.widget.Toast;

import com.seuic.uhftool.AppCache;
import com.seuic.uhftool.BaseDialog;
import com.seuic.uhftool.R;
import com.seuic.uhftool.SelectPopupWindow;
import com.seuic.uhftool.service.UhfService;

public class MainActivity extends FragmentActivity implements OnClickListener {

    private static final String TAG = "MainActivity";

    private static boolean now = true;

    Fragment mCurrentFragment;

    FragmentManager mFragmentManager;

    SelectPopupWindow mPopWindow;
    public static BaseDialog progressBar;
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        mFragmentManager = getSupportFragmentManager();
        mCurrentFragment = FragmentFactory.getFragmentByIndex(0);
        mPopWindow = new SelectPopupWindow(this);
		initTitle();
		initField();

        /*if (Build.VERSION.SDK_INT >= 23) {
            int REQUEST_CODE_CONTACT = 101;
            String[] permissions = {Manifest.permission.WRITE_EXTERNAL_STORAGE};
            //
            for (String str : permissions) {
                if (this.checkSelfPermission(str) != PackageManager.PERMISSION_GRANTED) {
                    //
                    this.requestPermissions(permissions, REQUEST_CODE_CONTACT);
                }
            }
        }*/
	}

    @Override
    protected void onPause() {
        super.onPause();
        AppCache.setScanEnable(true);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if(now)
            AppCache.setScanEnable(true);
        else
            AppCache.setScanEnable(false);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (mPopWindow!=null){
            mPopWindow.dismiss();
        }
        mPopWindow.unRegisterTERMINATEReceiver();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        refresh_UI();
    }

    public void refresh_UI() {
        rb_seek.setText(getString(R.string.msg_access_label));
        rb_readwrite.setText(getString(R.string.msg_readwrite));
        rb_barcode.setText(getString(R.string.msg_hard_settings));
        mPopWindow.refresh();
    }

    private void initField() {
        int curid = AppCache.getCurFragmentId();
        if (curid > 0) {
            switch (curid) {
                case R.id.rb_inventory:
                    rb_seek.setChecked(true);
                    break;
                case R.id.rb_readwrite:
                    rb_readwrite.setChecked(true);
                    break;
                case R.id.rb_barcodeconfig:
                    rb_barcode.setChecked(true);
                    break;
            }
            changeFragment(curid);
        } else {
            changeFragment(R.id.rb_inventory);
        }
    }

    private class CheckedChangListener implements OnCheckedChangeListener {
        @Override
        public void onCheckedChanged(RadioGroup group, int checkedId) {
            SeekFragment fragment = (SeekFragment)FragmentFactory.getFragmentByIndex(R.id.rb_inventory);
            if (UhfService.mInventoryStart || fragment.mInventoryStart||fragment.isstart) {
                Toast.makeText(MainActivity.this, getString(R.string.stop_inventory), Toast.LENGTH_SHORT).show();
                rb_seek.setChecked(true);
                return;
            }

            changeFragment(checkedId);
        }
    }

    private void changeFragment(int id) {
        final Fragment fragment = FragmentFactory.getFragmentByIndex(id);
        final FragmentTransaction transaction = mFragmentManager.beginTransaction();
        if (fragment instanceof SeekFragment){
            now =true;
        }else {
            now =false;
        }
        if (fragment != mCurrentFragment)
        {
            if (!fragment.isAdded() || (fragment.isAdded() && fragment.isVisible())) {
                if (mCurrentFragment != null)
                    transaction.hide(mCurrentFragment);
                if (fragment != null) {
                    if(fragment.isAdded()) {
                        AppCache.mRestartFragment = new Runnable() {
                            @Override
                            public void run() {
                                transaction.add(R.id.frl_content, fragment).show(fragment).commit();
                                AppCache.mRestartFragment = null;
                            }
                        };
                    } else {
                        transaction.add(R.id.frl_content, fragment).show(fragment).commit();
                    }
                }
                mCurrentFragment = fragment;
            } else {
                if (mCurrentFragment != null)
                    transaction.hide(mCurrentFragment);
                if (fragment != null) {
                    transaction.show(fragment).commit();
                }
                mCurrentFragment = fragment;
            }
        }
    }

    private ImageButton img_setting;
    private TextView txt_version;
    private RadioGroup radioGroup;
    private RadioButton rb_seek;
    private RadioButton rb_readwrite;
    private RadioButton rb_barcode;

    private void initTitle() {
        txt_version = (TextView) findViewById(R.id.txt_version);
        txt_version.setText(getResources().getString(R.string.msg_ver) + getVersionName());
        rb_seek = (RadioButton) findViewById(R.id.rb_inventory);
        rb_readwrite = (RadioButton) findViewById(R.id.rb_readwrite);
        rb_barcode = (RadioButton) findViewById(R.id.rb_barcodeconfig);
        img_setting = (ImageButton) findViewById(R.id.imb_setting);
        img_setting.setOnClickListener(this);
        radioGroup = (RadioGroup) findViewById(R.id.rg_tab);
        radioGroup.setOnCheckedChangeListener(new CheckedChangListener());
        if(!UhfService.uhfserver_isStart) {
            progressBar = new BaseDialog(this, R.layout.prodialog);
            progressBar.show();
        }
    }

    private String getVersionName() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (NameNotFoundException e) {
            e.printStackTrace();
        }
        return null;
    }

    @Override
    public void onClick(View v) {
        switch (v.getId()) {
            case R.id.imb_setting:
                mPopWindow.showAtLocation(
                       (View)MainActivity.this.findViewById(R.id.imb_setting),
                        Gravity.TOP | Gravity.RIGHT, 30, 85);
                break;

            default:
                break;
        }
    }
}
