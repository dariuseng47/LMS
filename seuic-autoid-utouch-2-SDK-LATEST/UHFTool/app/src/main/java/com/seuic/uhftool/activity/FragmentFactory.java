package com.seuic.uhftool.activity;

import android.support.v4.app.Fragment;
import com.seuic.uhftool.R;

public class FragmentFactory {

	private static Fragment[] fragments = new Fragment[]{new SeekFragment(), new UHFReadWrite(), new UhfFragment()};

	public static Fragment getFragmentByIndex(int index) {
		Fragment fragment = null;
		switch (index) {
		case R.id.rb_inventory:
			fragment = fragments[0];
			break;
		case R.id.rb_readwrite:
			fragment = fragments[1];
			break;
		case R.id.rb_barcodeconfig:
			fragment = fragments[2];
			break;
		default:
			break;
		}

		return fragment;
	}

}
