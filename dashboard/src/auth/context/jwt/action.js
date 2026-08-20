'use client';

import axios, { endpoints } from 'src/utils/axios';

import { setSession } from './utils';

/** **************************************
 * Sign in
 *************************************** */
export const signInWithPassword = async ({ username, password }) => {
  try {
    const params = { username, password };

    const res = await axios.post(endpoints.auth.signIn, params);

    const { accessToken } = res.data;

    if (!accessToken) {
      throw new Error('Access token not found in response');
    }

    setSession(accessToken);
  } catch (error) {
    console.error('Error during sign in:', error);
    throw error;
  }
};

/** **************************************
 * Sign up
 * ระบบนี้ไม่มี self sign-up สาธารณะ — บัญชีถูกสร้างโดย superadmin/admin เท่านั้น
 * ตาม docs/rbac-permissions.md (cascading delegation)
 *************************************** */
export const signUp = async () => {
  throw new Error('Self sign-up ไม่รองรับในระบบนี้ กรุณาติดต่อผู้ดูแลระบบเพื่อสร้างบัญชี');
};

/** **************************************
 * Sign out
 *************************************** */
export const signOut = async () => {
  try {
    await axios.post(endpoints.auth.logout); // revoke refresh token ฝั่ง server ด้วย ไม่ใช่แค่เคลียร์ token ฝั่ง client
  } catch (error) {
    console.error('Error revoking refresh token on server:', error);
  } finally {
    await setSession(null);
  }
};
