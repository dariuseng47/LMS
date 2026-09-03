package com.seuic.uhftool.iml;

import java.util.List;


public interface ICache {

	/**
	 *
	 */
	void clear();

	/**
	 *
	 * @param epcs
	 */
	void loadCache(List<Object> objects);
}
