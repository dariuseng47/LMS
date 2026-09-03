package com.seuic.uhftool.iml;

import com.seuic.uhftool.Cache;

public interface IUHFLogic {

	/**
	 *
	 * @return
	 */
	boolean inventoryStart();

	/**
	 *
	 * @param epc
	 * @param offset
	 * @param len
	 * @return
	 */
	boolean inventorySelectStart(byte[] epc, int offset, int len);


	/**
	 *
	 * @return
	 */
	boolean inventoryStop();

	boolean inventoryOnce(Cache epcUtil);

}
