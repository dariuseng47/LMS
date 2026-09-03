package com.seuic.uhftool;

//import android.annotation.NonNull;
import android.app.Activity;
import android.app.Dialog;
import android.content.Context;
import android.os.Bundle;
import android.view.Display;
import android.view.Gravity;
import android.view.Window;
import android.view.WindowManager;

public class BaseDialog extends Dialog {
    private Context context;
    private int layoutResID;

    public BaseDialog(Context context, int layoutResID) {
        super(context,R.style.CustomDialog);
        this.context = context;
        this.layoutResID = layoutResID;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window = getWindow();
        window.setGravity(Gravity.CENTER);
        setContentView(layoutResID);

        WindowManager windowManager = ((Activity) context).getWindowManager();
        Display display = windowManager.getDefaultDisplay();
        WindowManager.LayoutParams lp = getWindow().getAttributes();
        lp.width = display.getWidth();
        getWindow().setAttributes(lp);
        setCanceledOnTouchOutside(false);
    }
}
