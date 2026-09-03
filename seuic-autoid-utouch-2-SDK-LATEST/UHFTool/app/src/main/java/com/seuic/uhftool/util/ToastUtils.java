package com.seuic.uhftool.util;

import android.content.Context;
import android.widget.Toast;

public class ToastUtils {
      
    /**  */
    private static String oldMsg;
    /**  */
    private static Toast toast = null;
    /**  */
    private static long oneTime = 0;
    /**  */
    private static long twoTime = 0;
      
    /** 
     *
     * @param context 
     * @param message 
     */  
    public static void showToast(Context context, String message){
        twoTime = System.currentTimeMillis();
        if(twoTime - oneTime>1000) {
            toast = Toast.makeText(context, message, Toast.LENGTH_SHORT);
            toast.show();
        }
        oneTime = twoTime;
    }
}