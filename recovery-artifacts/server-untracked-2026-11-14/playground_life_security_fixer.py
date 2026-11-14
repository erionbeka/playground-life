#!/usr/bin/env python3
"""
Playground Life security patch installer — password/reset hardening phase.

Target commit: 11cb638.
IMPORTANT: This is a partial phase. It does NOT implement MFA login enforcement,
MFA-secret encryption/replay protection, or CSRF protection.

Run from the repository root:
    python3 playground_life_security_fixer.py

No .env changes, staging, commits, pushes, or service restarts are performed.
Timestamped backups are created before applying any changes.
"""
from __future__ import annotations
import base64
import datetime as dt
import hashlib
import os
from pathlib import Path
import subprocess
import sys
import tempfile

EXPECTED_COMMIT = "11cb638"
PATCH_B64 = (
    'ZGlmZiAtLWdpdCBhL3NlcnZlci9yb3V0ZXMvYXV0aC50cyBiL3NlcnZlci9yb3V0ZXMvYXV0aC50cwppbmRleCA0YjkxOWNhLi4z',
    'NzJkMjA0IDEwMDY0NAotLS0gYS9zZXJ2ZXIvcm91dGVzL2F1dGgudHMKKysrIGIvc2VydmVyL3JvdXRlcy9hdXRoLnRzCkBAIC0x',
    'LDExICsxLDkgQEAKIGltcG9ydCB7IFJvdXRlciB9IGZyb20gImV4cHJlc3MiOwotaW1wb3J0IHsgcmFuZG9tQnl0ZXMgfSBmcm9t',
    'ICJub2RlOmNyeXB0byI7CiBpbXBvcnQgeyB6IH0gZnJvbSAiem9kIjsKIGltcG9ydCB7IGhhc2hQYXNzd29yZCwgc2lnbkFjY2Vz',
    'c1Rva2VuLCB2ZXJpZnlQYXNzd29yZCB9IGZyb20gIi4uL2F1dGgudHMiOwogaW1wb3J0IHsgY29uZmlnLCBpc1Byb2R1Y3Rpb24g',
    'fSBmcm9tICIuLi9jb25maWcudHMiOwogaW1wb3J0IHsgcG9vbCwgcXVlcnkgfSBmcm9tICIuLi9kYi50cyI7CiBpbXBvcnQgeyBy',
    'ZXF1aXJlQXV0aCwgcmVxdWlyZVJvbGUgfSBmcm9tICIuLi9taWRkbGV3YXJlLnRzIjsKLWltcG9ydCB7IGFwcFVybCwgcXVldWVF',
    'bWFpbCB9IGZyb20gIi4uL2xpYi9tYWlsZXIudHMiOwogaW1wb3J0IHsgc2lnbkluTGltaXRlciB9IGZyb20gIi4uL3JhdGVMaW1p',
    'dC50cyI7CiBpbXBvcnQgeyB3cml0ZUF1ZGl0IH0gZnJvbSAiLi4vYXVkaXQudHMiOwogaW1wb3J0IHR5cGUgeyBVc2VyUm9sZSB9',
    'IGZyb20gIi4uL3R5cGVzLnRzIjsKQEAgLTMzLDE0ICszMSwxNCBAQCBhc3luYyBmdW5jdGlvbiBjYW5NYW5hZ2VBZG1pbkFjY291',
    'bnRzKHVzZXJJZDogc3RyaW5nLCBjbGluaWNJZDogc3RyaW5nKSB7CiAKIGNvbnN0IGxvZ2luU2NoZW1hID0gei5vYmplY3Qoewog',
    'ICBpZGVudGlmaWVyOiB6LnN0cmluZygpLm1pbigxKSwKLSAgcGFzc3dvcmQ6IHouc3RyaW5nKCkubWluKDEpLAorICBwYXNzd29y',
    'ZDogei5zdHJpbmcoKS5taW4oMSkubWF4KDEyOCksCiB9KTsKIAogY29uc3QgY3JlYXRlU3RhZmZTY2hlbWEgPSB6Lm9iamVjdCh7',
    'CiAgIHJvbGU6IHouZW51bShbImFkbWluIiwgInRoZXJhcGlzdCJdKSwKICAgbmFtZTogei5zdHJpbmcoKS5taW4oMiksCiAgIGVt',
    'YWlsOiB6LnN0cmluZygpLmVtYWlsKCksCi0gIHBhc3N3b3JkOiB6LnN0cmluZygpLm1pbigxKSwKKyAgcGFzc3dvcmQ6IHouc3Ry',
    'aW5nKCkubWluKDEyKS5tYXgoMTI4KSwKIH0pOwogCiBmdW5jdGlvbiBzZXRTZXNzaW9uQ29va2llKHJlczogaW1wb3J0KCJleHBy',
    'ZXNzIikuUmVzcG9uc2UsIHRva2VuOiBzdHJpbmcpIHsKQEAgLTE2Niw3ICsxNjQsNyBAQCByb3V0ZXIucG9zdCgiL3N0YWZmIiwg',
    'cmVxdWlyZUF1dGgsIHJlcXVpcmVSb2xlKCJhZG1pbiIpLCBhc3luYyAocmVxLCByZXMpID0+IHsKICAqIGFwcGVhcnMgaW4gdGhl',
    'IGxpc3QuIFNjb3BlZCB0byB0aGUgY2FsbGVyJ3MgY2xpbmljOyBhZG1pbnMgb25seSwgYmVjYXVzZSB0aGUKICAqIHJvc3RlciBl',
    'eHBvc2VzIHN0YWZmIGVtYWlsIGFkZHJlc3NlcyBhbmQgY3JlZGVudGlhbCBzdGF0ZS4KICAqLwotY29uc3Qgc3RhZmZSZXNldFNj',
    'aGVtYSA9IHoub2JqZWN0KHsgcGFzc3dvcmQ6IHouc3RyaW5nKCkubWluKDgpLm9wdGlvbmFsKCkgfSk7Citjb25zdCBzdGFmZlJl',
    'c2V0U2NoZW1hID0gei5vYmplY3QoeyBwYXNzd29yZDogei5zdHJpbmcoKS5taW4oMTIpLm1heCgxMjgpIH0pOwogY29uc3Qgc3Rh',
    'ZmZTdGF0dXNTY2hlbWEgPSB6Lm9iamVjdCh7IHN0YXR1czogei5lbnVtKFsiYWN0aXZlIiwgInN1c3BlbmRlZCJdKSB9KTsKIAog',
    'cm91dGVyLnBvc3QoIi9zdGFmZi86aWQvcmVzZXQtcGFzc3dvcmQiLCByZXF1aXJlQXV0aCwgcmVxdWlyZVJvbGUoImFkbWluIiks',
    'IGFzeW5jIChyZXEsIHJlcykgPT4gewpAQCAtMTgwLDggKzE3OCw3IEBAIHJvdXRlci5wb3N0KCIvc3RhZmYvOmlkL3Jlc2V0LXBh',
    'c3N3b3JkIiwgcmVxdWlyZUF1dGgsIHJlcXVpcmVSb2xlKCJhZG1pbiIpLCBhc3luCiAgICAgICAhKGF3YWl0IGNhbk1hbmFnZUFk',
    'bWluQWNjb3VudHMocmVxLnVzZXIhLmlkLCByZXEudXNlciEuY2xpbmljSWQpKSkgewogICAgIHJldHVybiByZXMuc3RhdHVzKDQw',
    'MykuanNvbih7IGVycm9yOiAiQWRtaW4tbWFuYWdlbWVudCBwZXJtaXNzaW9uIHJlcXVpcmVkIiB9KTsKICAgfQotICBjb25zdCBw',
    'YXNzd29yZCA9IHBhcnNlZC5kYXRhLnBhc3N3b3JkIHx8IGBUbXAtJHtyYW5kb21CeXRlcyg0KS50b1N0cmluZygiaGV4Iil9YDsK',
    'LSAgY29uc3QgcGFzc3dvcmRIYXNoID0gYXdhaXQgaGFzaFBhc3N3b3JkKHBhc3N3b3JkKTsKKyAgY29uc3QgcGFzc3dvcmRIYXNo',
    'ID0gYXdhaXQgaGFzaFBhc3N3b3JkKHBhcnNlZC5kYXRhLnBhc3N3b3JkKTsKICAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHF1ZXJ5',
    'PHsgaWQ6IHN0cmluZzsgZW1haWw6IHN0cmluZyB8IG51bGw7IG5hbWU6IHN0cmluZyB9PigKICAgICBgVVBEQVRFIHVzZXJzIFNF',
    'VCBwYXNzd29yZF9oYXNoID0gJDEsIGNyZWRlbnRpYWxfc3RhdHVzID0gJ2FjdGl2ZScsCiAgICAgICAgc2Vzc2lvbl92ZXJzaW9u',
    'ID0gc2Vzc2lvbl92ZXJzaW9uICsgMSwgdXBkYXRlZF9hdCA9IG5vdygpCkBAIC0xOTAsMTcgKzE4NywxMSBAQCByb3V0ZXIucG9z',
    'dCgiL3N0YWZmLzppZC9yZXNldC1wYXNzd29yZCIsIHJlcXVpcmVBdXRoLCByZXF1aXJlUm9sZSgiYWRtaW4iKSwgYXN5bgogICAg',
    'IFtwYXNzd29yZEhhc2gsIGlkLCByZXEudXNlcj8uY2xpbmljSWRdCiAgICk7CiAgIGlmICghdXBkYXRlZC5yb3dzWzBdKSByZXR1',
    'cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogIlN0YWZmIG1lbWJlciBub3QgZm91bmQiIH0pOwotICBjb25zdCBzdGFm',
    'ZiA9IHVwZGF0ZWQucm93c1swXTsKLSAgaWYgKHN0YWZmLmVtYWlsKSB7Ci0gICAgYXdhaXQgcXVldWVFbWFpbCh7Ci0gICAgICB0',
    'bzogc3RhZmYuZW1haWwsCi0gICAgICBraW5kOiAicmVzZXQiLAotICAgICAgc3ViamVjdDogIllvdXIgUGxheWdyb3VuZCBMaWZl',
    'IHBhc3N3b3JkIHdhcyByZXNldCIsCi0gICAgICBib2R5OiBgWW91ciBwYXNzd29yZCB3YXMgcmVzZXQuIE5ldyBwYXNzd29yZDog',
    'JHtwYXNzd29yZH0uIFNpZ24gaW4gYXQgJHthcHBVcmwoKX0uXG5cbkZqYWzDq2thbGltaSBqdWFqIHUgcml2ZW5kb3MuIEZqYWzD',
    'q2thbGltaSBpIHJpOiAke3Bhc3N3b3JkfS4gSHluaSBuw6sgJHthcHBVcmwoKX0uYCwKLSAgICB9KTsKLSAgfQogICBhd2FpdCB3',
    'cml0ZUF1ZGl0KHJlcSwgInN0YWZmX3Bhc3N3b3JkX3Jlc2V0IiwgInN0YWZmIiwgaWQsIHt9KTsKLSAgcmV0dXJuIHJlcy5qc29u',
    'KHsgdXNlcklkOiBpZCwgZW1haWxlZDogISFzdGFmZi5lbWFpbCwgdGVtcG9yYXJ5UGFzc3dvcmQ6IHBhc3N3b3JkIH0pOworICAv',
    'LyBOZXZlciBlbWFpbCBvciByZXR1cm4gYSBwYXNzd29yZC4gVGhlIGFkbWluaXN0cmF0b3Igc3VwcGxpZWQgdGhlIG5ldworICAv',
    'LyBwYXNzd29yZCB0aHJvdWdoIHRoZSBhdXRoZW50aWNhdGVkIHJlcXVlc3Q7IGNvbW11bmljYXRlIGl0IHRvIHRoZSBzdGFmZgor',
    'ICAvLyBtZW1iZXIgdGhyb3VnaCBhbiBhcHByb3ZlZCBvdXQtb2YtYmFuZCBjaGFubmVsLgorICByZXR1cm4gcmVzLmpzb24oeyB1',
    'c2VySWQ6IGlkLCByZXNldDogdHJ1ZSB9KTsKIH0pOwogCiByb3V0ZXIucGF0Y2goIi9zdGFmZi86aWQvc3RhdHVzIiwgcmVxdWly',
    'ZUF1dGgsIHJlcXVpcmVSb2xlKCJhZG1pbiIpLCBhc3luYyAocmVxLCByZXMpID0+IHsKZGlmZiAtLWdpdCBhL3NlcnZlci9yb3V0',
    'ZXMvZmFtaWxpZXMudHMgYi9zZXJ2ZXIvcm91dGVzL2ZhbWlsaWVzLnRzCmluZGV4IDgxMzk4YjEuLjE0ODkyNTIgMTAwNjQ0Ci0t',
    'LSBhL3NlcnZlci9yb3V0ZXMvZmFtaWxpZXMudHMKKysrIGIvc2VydmVyL3JvdXRlcy9mYW1pbGllcy50cwpAQCAtMjMsMTEgKzIz',
    'LDExIEBAIGNvbnN0IGNhcmVnaXZlclNjaGVtYSA9IHoub2JqZWN0KHsKICAgcmVsYXRpb25zaGlwOiB6LnN0cmluZygpLm1pbigy',
    'KSwKICAgcGhvbmVOdW1iZXI6IHouc3RyaW5nKCkubWluKDcpLAogICBlbWFpbDogei5zdHJpbmcoKS5lbWFpbCgpLm9wdGlvbmFs',
    'KCksCi0gIHRlbXBvcmFyeVBhc3N3b3JkOiB6LnN0cmluZygpLm1pbig4KS5vcHRpb25hbCgpLAorICB0ZW1wb3JhcnlQYXNzd29y',
    'ZDogei5zdHJpbmcoKS5taW4oMTIpLm1heCgxMjgpLAogfSk7CiAKIGNvbnN0IHJlc2V0U2NoZW1hID0gei5vYmplY3QoewotICB0',
    'ZW1wb3JhcnlQYXNzd29yZDogei5zdHJpbmcoKS5taW4oOCksCisgIHRlbXBvcmFyeVBhc3N3b3JkOiB6LnN0cmluZygpLm1pbigx',
    'MikubWF4KDEyOCksCiAgIGNyZWRlbnRpYWxTdGF0dXM6IHouZW51bShbImFjdGl2ZSIsICJwZW5kaW5nIl0pLmRlZmF1bHQoImFj',
    'dGl2ZSIpLAogfSk7CiAKQEAgLTU3LDggKzU3LDcgQEAgcm91dGVyLnBvc3QoIi8iLCByZXF1aXJlQXV0aCwgcmVxdWlyZVJvbGUo',
    'ImFkbWluIiksIGFzeW5jIChyZXEsIHJlcykgPT4gewogICBjb25zdCBwYXJzZWQgPSBjYXJlZ2l2ZXJTY2hlbWEuc2FmZVBhcnNl',
    'KHJlcS5ib2R5KTsKICAgaWYgKCFwYXJzZWQuc3VjY2VzcykgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6ICJJ',
    'bnZhbGlkIGNhcmVnaXZlciBwYXlsb2FkIiB9KTsKIAotICBjb25zdCB0ZW1wb3JhcnlQYXNzd29yZCA9IHBhcnNlZC5kYXRhLnRl',
    'bXBvcmFyeVBhc3N3b3JkIHx8IGBUbXAtJHtyYW5kb21CeXRlcyg0KS50b1N0cmluZygiaGV4Iil9YDsKLSAgY29uc3QgcGFzc3dv',
    'cmRIYXNoID0gYXdhaXQgaGFzaFBhc3N3b3JkKHRlbXBvcmFyeVBhc3N3b3JkKTsKKyAgY29uc3QgcGFzc3dvcmRIYXNoID0gYXdh',
    'aXQgaGFzaFBhc3N3b3JkKHBhcnNlZC5kYXRhLnRlbXBvcmFyeVBhc3N3b3JkKTsKICAgY29uc3QgY3JlYXRlZCA9IGF3YWl0IHdp',
    'dGhUcmFuc2FjdGlvbihhc3luYyAoY2xpZW50KSA9PiB7CiAgICAgY29uc3QgY2hpbGQgPSBhd2FpdCBjbGllbnQucXVlcnk8eyBp',
    'ZDogc3RyaW5nIH0+KAogICAgICAgYFNFTEVDVCBpZApAQCAtOTcsMTMgKzk2LDEzIEBAIHJvdXRlci5wb3N0KCIvIiwgcmVxdWly',
    'ZUF1dGgsIHJlcXVpcmVSb2xlKCJhZG1pbiIpLCBhc3luYyAocmVxLCByZXMpID0+IHsKICAgaWYgKHBhcnNlZC5kYXRhLmVtYWls',
    'KSB7CiAgICAgYXdhaXQgcXVldWVFbWFpbCh7CiAgICAgICB0bzogcGFyc2VkLmRhdGEuZW1haWwsCi0gICAgICBraW5kOiAiaW52',
    'aXRlIiwKLSAgICAgIHN1YmplY3Q6ICJZb3VyIFBsYXlncm91bmQgTGlmZSBmYW1pbHkgYWNjZXNzIiwKLSAgICAgIGJvZHk6IGBZ',
    'b3UgY2FuIHNpZ24gaW4gd2l0aCBwaG9uZSAke3BhcnNlZC5kYXRhLnBob25lTnVtYmVyfSBhbmQgdGVtcG9yYXJ5IHBhc3N3b3Jk',
    'ICR7dGVtcG9yYXJ5UGFzc3dvcmR9LiBTaWduIGluIGF0ICR7YXBwVXJsKCl9LlxuXG5NdW5kIHTDqyBoeW5pIG1lIHRlbGVmb25p',
    'biAke3BhcnNlZC5kYXRhLnBob25lTnVtYmVyfSBkaGUgZmphbMOra2FsaW1pbiBlIHDDq3Jrb2hzaMOrbSAke3RlbXBvcmFyeVBh',
    'c3N3b3JkfS4gSHluaSBuw6sgJHthcHBVcmwoKX0uYCwKKyAgICAgIGtpbmQ6ICJub3RpY2UiLAorICAgICAgc3ViamVjdDogIllv',
    'dXIgUGxheWdyb3VuZCBMaWZlIGZhbWlseSBhY2Nlc3MgaXMgcmVhZHkiLAorICAgICAgYm9keTogYFlvdXIgZmFtaWx5IGFjY2Vz',
    'cyBoYXMgYmVlbiBjcmVhdGVkLiBTaWduIGluIGF0ICR7YXBwVXJsKCl9IHVzaW5nIHRoZSBwaG9uZSBudW1iZXIgcHJvdmlkZWQg',
    'YnkgeW91ciBjbGluaWMuIENvbnRhY3QgeW91ciBjbGluaWMgYWRtaW5pc3RyYXRvciBpZiB5b3UgbmVlZCBoZWxwLlxuXG5RYXNq',
    'YSBqdWFqIGZhbWlsamFyZSDDq3NodMOrIGtyaWp1YXIuIEh5bmkgbsOrICR7YXBwVXJsKCl9IG1lIG51bXJpbiBlIHRlbGVmb25p',
    'dCBxw6sganUga2EgZGjDq27DqyBrbGluaWthLiBLb250YWt0b25pIGFkbWluaXN0cmF0b3JpbiBlIGtsaW5pa8OrcyBuw6tzZSBr',
    'ZW5pIG5ldm9qw6sgcMOrciBuZGlobcOrLmAsCiAgICAgfSk7CiAgIH0KIAotICByZXR1cm4gcmVzLnN0YXR1cygyMDEpLmpzb24o',
    'eyBpZDogY3JlYXRlZC5saW5rSWQsIHVzZXJJZDogY3JlYXRlZC51c2VySWQsIGVtYWlsZWQ6ICEhcGFyc2VkLmRhdGEuZW1haWws',
    'IHRlbXBvcmFyeVBhc3N3b3JkIH0pOworICByZXR1cm4gcmVzLnN0YXR1cygyMDEpLmpzb24oeyBpZDogY3JlYXRlZC5saW5rSWQs',
    'IHVzZXJJZDogY3JlYXRlZC51c2VySWQsIGVtYWlsZWQ6ICEhcGFyc2VkLmRhdGEuZW1haWwgfSk7CiB9KTsKIAogcm91dGVyLnBv',
    'c3QoIi86dXNlcklkL3Jlc2V0LXBhc3N3b3JkIiwgcmVxdWlyZUF1dGgsIHJlcXVpcmVSb2xlKCJhZG1pbiIpLCBhc3luYyAocmVx',
    'LCByZXMpID0+IHsKQEAgLTEyNSwxNiArMTI0LDggQEAgcm91dGVyLnBvc3QoIi86dXNlcklkL3Jlc2V0LXBhc3N3b3JkIiwgcmVx',
    'dWlyZUF1dGgsIHJlcXVpcmVSb2xlKCJhZG1pbiIpLCBhc3luYwogCiAgIGlmICghdXBkYXRlZC5yb3dzWzBdKSByZXR1cm4gcmVz',
    'LnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogIkNhcmVnaXZlciBub3QgZm91bmQiIH0pOwogCi0gIGNvbnN0IGNhcmVnaXZlciA9',
    'IHVwZGF0ZWQucm93c1swXTsKLSAgaWYgKGNhcmVnaXZlci5lbWFpbCkgewotICAgIGF3YWl0IHF1ZXVlRW1haWwoewotICAgICAg',
    'dG86IGNhcmVnaXZlci5lbWFpbCwKLSAgICAgIGtpbmQ6ICJyZXNldCIsCi0gICAgICBzdWJqZWN0OiAiWW91ciBQbGF5Z3JvdW5k',
    'IExpZmUgcGFzc3dvcmQgd2FzIHJlc2V0IiwKLSAgICAgIGJvZHk6IGBZb3VyIHRlbXBvcmFyeSBwYXNzd29yZCBpcyAke3BhcnNl',
    'ZC5kYXRhLnRlbXBvcmFyeVBhc3N3b3JkfS4gU2lnbiBpbiBhdCAke2FwcFVybCgpfSB3aXRoIHBob25lICR7Y2FyZWdpdmVyLnBo',
    'b25lX251bWJlcn0uXG5cbkZqYWzDq2thbGltaSBqdWFqIGkgcMOrcmtvaHNow6ttIMOrc2h0w6sgJHtwYXJzZWQuZGF0YS50ZW1w',
    'b3JhcnlQYXNzd29yZH0uIEh5bmkgbsOrICR7YXBwVXJsKCl9IG1lIHRlbGVmb25pbiAke2NhcmVnaXZlci5waG9uZV9udW1iZXJ9',
    'LmAsCi0gICAgfSk7Ci0gIH0KLQorICAvLyBQYXNzd29yZHMgbXVzdCBuZXZlciBiZSBzZW50IHRocm91Z2ggZW1haWwuIFRoZSBh',
    'ZG1pbmlzdHJhdG9yIHN1cHBsaWVzCisgIC8vIHRoZSBuZXcgY3JlZGVudGlhbCBhbmQgY29tbXVuaWNhdGVzIGl0IHRvIHRoZSBj',
    'YXJlZ2l2ZXIgb3V0IG9mIGJhbmQuCiAgIGF3YWl0IHdyaXRlQXVkaXQocmVxLCAiY2FyZWdpdmVyX3Bhc3N3b3JkX3Jlc2V0Iiwg',
    'ImNyZWRlbnRpYWwiLCB1c2VySWQsIHsgY3JlZGVudGlhbFN0YXR1czogcGFyc2VkLmRhdGEuY3JlZGVudGlhbFN0YXR1cyB9KTsK',
    'ICAgcmV0dXJuIHJlcy5qc29uKHsgdXNlcklkLCBjcmVkZW50aWFsU3RhdHVzOiBwYXJzZWQuZGF0YS5jcmVkZW50aWFsU3RhdHVz',
    'IH0pOwogfSk7CmRpZmYgLS1naXQgYS9zZXJ2ZXIvcm91dGVzL3NlY3VyaXR5LnRzIGIvc2VydmVyL3JvdXRlcy9zZWN1cml0eS50',
    'cwppbmRleCAwMDI3M2VlLi4wNjhjNjI4IDEwMDY0NAotLS0gYS9zZXJ2ZXIvcm91dGVzL3NlY3VyaXR5LnRzCisrKyBiL3NlcnZl',
    'ci9yb3V0ZXMvc2VjdXJpdHkudHMKQEAgLTIxLDcgKzIxLDcgQEAgY29uc3QgcmVzZXRSZXF1ZXN0U2NoZW1hID0gei5vYmplY3Qo',
    'eyBlbWFpbDogei5zdHJpbmcoKS5lbWFpbCgpIH0pOwogLy8gVHdlbHZlIGNoYXJhY3RlcnMsIHRoZSBzYW1lIHJ1bGUgZXZlcnkg',
    'b3RoZXIgcGFzc3dvcmQgaW4gdGhlIGFwcCBmb2xsb3dzLgogLy8gQSB3ZWFrZXIgcnVsZSBvbiB0aGUgcmVzZXQgcGF0aCB3b3Vs',
    'ZCBsZXQgYW55b25lIHdobyBjYW4gcmVhY2ggYSByZXNldAogLy8gZm9ybSBjaG9vc2UgYSBwYXNzd29yZCB3ZWFrZXIgdGhhbiB0',
    'aGUgc2lnbi11cCBmb3JtIGFsbG93cy4KLWNvbnN0IHJlc2V0Q29uZmlybVNjaGVtYSA9IHoub2JqZWN0KHsgdG9rZW46IHouc3Ry',
    'aW5nKCkubWluKDIwKSwgcGFzc3dvcmQ6IHouc3RyaW5nKCkubWluKDgpIH0pOworY29uc3QgcmVzZXRDb25maXJtU2NoZW1hID0g',
    'ei5vYmplY3QoeyB0b2tlbjogei5zdHJpbmcoKS5taW4oMjApLCBwYXNzd29yZDogei5zdHJpbmcoKS5taW4oMTIpLm1heCgxMjgp',
    'IH0pOwogY29uc3QgbWZhVG9rZW5TY2hlbWEgPSB6Lm9iamVjdCh7IHRva2VuOiB6LnN0cmluZygpLmxlbmd0aCg2KSB9KTsKIAog',
    'c2VjdXJpdHlSb3V0ZXMucG9zdCgiL3Jlc2V0LXJlcXVlc3QiLCByZXNldFJlcXVlc3RMaW1pdGVyLCBhc3luYyAocmVxOiBSZXF1',
    'ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7CkBAIC01NSwzMiArNTUsNDggQEAgc2VjdXJpdHlSb3V0ZXMucG9zdCgiL3Jlc2V0LWNv',
    'bmZpcm0iLCByZXNldENvbmZpcm1MaW1pdGVyLCBhc3luYyAocmVxOiBSZXF1ZXN0LAogICBjb25zdCBwYXJzZWQgPSByZXNldENv',
    'bmZpcm1TY2hlbWEuc2FmZVBhcnNlKHJlcS5ib2R5KTsKICAgaWYgKCFwYXJzZWQuc3VjY2VzcykgcmV0dXJuIHJlcy5zdGF0dXMo',
    'NDAwKS5qc29uKHsgZXJyb3I6ICJJbnZhbGlkIHJlc2V0IHBheWxvYWQiIH0pOwogCi0gIGNvbnN0IHJvd3MgPSBhd2FpdCBxdWVy',
    'eTx7IGlkOiBzdHJpbmc7IHVzZXJfaWQ6IHN0cmluZyB9PigKLSAgICBgU0VMRUNUIGlkLCB1c2VyX2lkIEZST00gcGFzc3dvcmRf',
    'cmVzZXRfdG9rZW5zCi0gICAgIFdIRVJFIHRva2VuX2hhc2ggPSAkMSBBTkQgdXNlZF9hdCBJUyBOVUxMIEFORCBleHBpcmVzX2F0',
    'ID4gbm93KCkKLSAgICAgTElNSVQgMWAsCi0gICAgW3NoYTI1NihwYXJzZWQuZGF0YS50b2tlbildCi0gICk7Ci0KLSAgaWYgKHJv',
    'd3Mucm93cy5sZW5ndGggPT09IDApIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7IGVycm9yOiAiUmVzZXQgbGluayBpcyBp',
    'bnZhbGlkIG9yIGV4cGlyZWQiIH0pOwotCi0gIGNvbnN0IHRva2VuUm93ID0gcm93cy5yb3dzWzBdOwogICBjb25zdCBwYXNzd29y',
    'ZEhhc2ggPSBhd2FpdCBoYXNoUGFzc3dvcmQocGFyc2VkLmRhdGEucGFzc3dvcmQpOworICBjb25zdCBjbGllbnQgPSBhd2FpdCBw',
    'b29sLmNvbm5lY3QoKTsKKyAgdHJ5IHsKKyAgICBhd2FpdCBjbGllbnQucXVlcnkoIkJFR0lOIik7CisgICAgY29uc3Qgcm93cyA9',
    'IGF3YWl0IGNsaWVudC5xdWVyeTx7IGlkOiBzdHJpbmc7IHVzZXJfaWQ6IHN0cmluZyB9PigKKyAgICAgIGBTRUxFQ1QgaWQsIHVz',
    'ZXJfaWQgRlJPTSBwYXNzd29yZF9yZXNldF90b2tlbnMKKyAgICAgICBXSEVSRSB0b2tlbl9oYXNoID0gJDEgQU5EIHVzZWRfYXQg',
    'SVMgTlVMTCBBTkQgZXhwaXJlc19hdCA+IG5vdygpCisgICAgICAgTElNSVQgMSBGT1IgVVBEQVRFYCwKKyAgICAgIFtzaGEyNTYo',
    'cGFyc2VkLmRhdGEudG9rZW4pXQorICAgICk7CisgICAgY29uc3QgdG9rZW5Sb3cgPSByb3dzLnJvd3NbMF07CisgICAgaWYgKCF0',
    'b2tlblJvdykgeworICAgICAgYXdhaXQgY2xpZW50LnF1ZXJ5KCJST0xMQkFDSyIpOworICAgICAgcmV0dXJuIHJlcy5zdGF0dXMo',
    'NDAwKS5qc29uKHsgZXJyb3I6ICJSZXNldCBsaW5rIGlzIGludmFsaWQgb3IgZXhwaXJlZCIgfSk7CisgICAgfQogCi0gIGF3YWl0',
    'IHF1ZXJ5KAotICAgIGBVUERBVEUgdXNlcnMKLSAgICAgU0VUIHBhc3N3b3JkX2hhc2ggPSAkMSwKLSAgICAgICAgIHNlc3Npb25f',
    'dmVyc2lvbiA9IHNlc3Npb25fdmVyc2lvbiArIDEsCi0gICAgICAgICB1cGRhdGVkX2F0ID0gbm93KCkKLSAgICAgV0hFUkUgaWQg',
    'PSAkMmAsCi0gICAgW3Bhc3N3b3JkSGFzaCwgdG9rZW5Sb3cudXNlcl9pZF0KLSAgKTsKLSAgYXdhaXQgcXVlcnkoIlVQREFURSBw',
    'YXNzd29yZF9yZXNldF90b2tlbnMgU0VUIHVzZWRfYXQgPSBub3coKSBXSEVSRSBpZCA9ICQxIiwgW3Rva2VuUm93LmlkXSk7Ci0g',
    'IGF3YWl0IHF1ZXJ5KAotICAgIGBJTlNFUlQgSU5UTyBhdWRpdF9sb2cgKGFjdG9yX3VzZXJfaWQsIGFjdGlvbiwgZW50aXR5X3R5',
    'cGUsIGVudGl0eV9pZCwgZGV0YWlscykKLSAgICAgVkFMVUVTICgkMSwgJ3Bhc3N3b3JkX3Jlc2V0JywgJ2F1dGgnLCAkMiwgJ3si',
    'dmlhIjoicmVzZXRfdG9rZW4ifSc6Ompzb25iKWAsCi0gICAgW3Rva2VuUm93LnVzZXJfaWQsIHRva2VuUm93LnVzZXJfaWRdCi0g',
    'ICk7CisgICAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IGNsaWVudC5xdWVyeSgKKyAgICAgIGBVUERBVEUgdXNlcnMgU0VUIHBhc3N3',
    'b3JkX2hhc2ggPSAkMSwKKyAgICAgICAgIHNlc3Npb25fdmVyc2lvbiA9IHNlc3Npb25fdmVyc2lvbiArIDEsIHVwZGF0ZWRfYXQg',
    'PSBub3coKQorICAgICAgIFdIRVJFIGlkID0gJDJgLAorICAgICAgW3Bhc3N3b3JkSGFzaCwgdG9rZW5Sb3cudXNlcl9pZF0KKyAg',
    'ICApOworICAgIGlmICh1cGRhdGVkLnJvd0NvdW50ICE9PSAxKSB7CisgICAgICBhd2FpdCBjbGllbnQucXVlcnkoIlJPTExCQUNL',
    'Iik7CisgICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oeyBlcnJvcjogIlJlc2V0IGxpbmsgaXMgaW52YWxpZCBvciBl',
    'eHBpcmVkIiB9KTsKKyAgICB9CisgICAgYXdhaXQgY2xpZW50LnF1ZXJ5KAorICAgICAgIlVQREFURSBwYXNzd29yZF9yZXNldF90',
    'b2tlbnMgU0VUIHVzZWRfYXQgPSBub3coKSBXSEVSRSBpZCA9ICQxIEFORCB1c2VkX2F0IElTIE5VTEwiLAorICAgICAgW3Rva2Vu',
    'Um93LmlkXQorICAgICk7CisgICAgYXdhaXQgY2xpZW50LnF1ZXJ5KAorICAgICAgYElOU0VSVCBJTlRPIGF1ZGl0X2xvZyAoYWN0',
    'b3JfdXNlcl9pZCwgYWN0aW9uLCBlbnRpdHlfdHlwZSwgZW50aXR5X2lkLCBkZXRhaWxzKQorICAgICAgIFZBTFVFUyAoJDEsICdw',
    'YXNzd29yZF9yZXNldCcsICdhdXRoJywgJDIsICd7InZpYSI6InJlc2V0X3Rva2VuIn0nOjpqc29uYilgLAorICAgICAgW3Rva2Vu',
    'Um93LnVzZXJfaWQsIHRva2VuUm93LnVzZXJfaWRdCisgICAgKTsKKyAgICBhd2FpdCBjbGllbnQucXVlcnkoIkNPTU1JVCIpOwor',
    'ICB9IGNhdGNoIChlcnJvcikgeworICAgIGF3YWl0IGNsaWVudC5xdWVyeSgiUk9MTEJBQ0siKS5jYXRjaCgoKSA9PiB7fSk7Cisg',
    'ICAgdGhyb3cgZXJyb3I7CisgIH0gZmluYWxseSB7CisgICAgY2xpZW50LnJlbGVhc2UoKTsKKyAgfQogCiAgIHJldHVybiByZXMu',
    'anNvbih7IG9rOiB0cnVlIH0pOwogfSk7CkBAIC0xODQsMTMgKzIwMCwxMyBAQCBzZWN1cml0eVJvdXRlcy5wb3N0KCIvaW52aXRh',
    'dGlvbnMiLCByZXF1aXJlQXV0aCwgcmVxdWlyZVJvbGUoImFkbWluIiksIGFzeW5jIChyZQogY29uc3QgYWNjZXB0SW52aXRlU2No',
    'ZW1hID0gei5vYmplY3QoewogICB0b2tlbjogei5zdHJpbmcoKS5taW4oMjApLAogICBuYW1lOiB6LnN0cmluZygpLm1pbigyKSwK',
    'LSAgcGFzc3dvcmQ6IHouc3RyaW5nKCkubWluKDgpLAorICBwYXNzd29yZDogei5zdHJpbmcoKS5taW4oMTIpLm1heCgxMjgpLAog',
    'fSk7CiAKIHNlY3VyaXR5Um91dGVzLnBvc3QoIi9pbnZpdGF0aW9ucy9hY2NlcHQiLCBpbnZpdGF0aW9uQWNjZXB0TGltaXRlciwg',
    'YXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSkgPT4gewogICBjb25zdCBwYXJzZWQgPSBhY2NlcHRJbnZpdGVTY2hl',
    'bWEuc2FmZVBhcnNlKHJlcS5ib2R5KTsKICAgaWYgKCFwYXJzZWQuc3VjY2VzcykgewotICAgIHJldHVybiByZXMuc3RhdHVzKDQw',
    'MCkuanNvbih7IGVycm9yOiAiTmFtZSAoMisgY2hhcnMpIGFuZCBwYXNzd29yZCAoOCsgY2hhcnMpIHJlcXVpcmVkIiB9KTsKKyAg',
    'ICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oeyBlcnJvcjogIk5hbWUgKDIrIGNoYXJzKSBhbmQgcGFzc3dvcmQgKDEyKyBj',
    'aGFycykgcmVxdWlyZWQiIH0pOwogICB9CiAKICAgY29uc3QgcGFzc3dvcmRIYXNoID0gYXdhaXQgaGFzaFBhc3N3b3JkKHBhcnNl',
    'ZC5kYXRhLnBhc3N3b3JkKTsKZGlmZiAtLWdpdCBhL3NlcnZlci90ZXN0L3NlY3VyaXR5LXJvdXRlcy50ZXN0LnRzIGIvc2VydmVy',
    'L3Rlc3Qvc2VjdXJpdHktcm91dGVzLnRlc3QudHMKaW5kZXggYWQ4ZDFlZC4uOWUyNzI2MyAxMDA2NDQKLS0tIGEvc2VydmVyL3Rl',
    'c3Qvc2VjdXJpdHktcm91dGVzLnRlc3QudHMKKysrIGIvc2VydmVyL3Rlc3Qvc2VjdXJpdHktcm91dGVzLnRlc3QudHMKQEAgLTcs',
    'MTAgKzcsMTIgQEAgY29uc3QgcXVlcnlNb2NrID0gdmkuaG9pc3RlZCgoKSA9PiB2aS5mbigpKTsKIGNvbnN0IGhhc2hQYXNzd29y',
    'ZE1vY2sgPSB2aS5ob2lzdGVkKCgpID0+IHZpLmZuKGFzeW5jIChwYXNzd29yZDogc3RyaW5nKSA9PiBgaGFzaGVkLSR7cGFzc3dv',
    'cmR9YCkpOwogY29uc3QgdmVyaWZ5VG90cE1vY2sgPSB2aS5ob2lzdGVkKCgpID0+IHZpLmZuKChzZWNyZXQ6IHN0cmluZywgdG9r',
    'ZW46IHN0cmluZykgPT4gdG9rZW4gPT09ICIxMjM0NTYiKSk7CiBjb25zdCB3cml0ZUF1ZGl0TW9jayA9IHZpLmhvaXN0ZWQoKCkg',
    'PT4gdmkuZm4oKSk7Citjb25zdCB0cmFuc2FjdGlvblF1ZXJ5TW9jayA9IHZpLmhvaXN0ZWQoKCkgPT4gdmkuZm4oKSk7Citjb25z',
    'dCBwb29sQ29ubmVjdE1vY2sgPSB2aS5ob2lzdGVkKCgpID0+IHZpLmZuKGFzeW5jICgpID0+ICh7IHF1ZXJ5OiB0cmFuc2FjdGlv',
    'blF1ZXJ5TW9jaywgcmVsZWFzZTogdmkuZm4oKSB9KSkpOwogCiB2aS5tb2NrKCIuLi9kYi50cyIsICgpID0+ICh7CiAgIHF1ZXJ5',
    'OiBxdWVyeU1vY2ssCi0gIHBvb2w6IHt9LAorICBwb29sOiB7IGNvbm5lY3Q6IHBvb2xDb25uZWN0TW9jayB9LAogICBjbG9zZVBv',
    'b2w6IHZpLmZuKCksCiB9KSk7CiAKQEAgLTY1LDYgKzY3LDggQEAgYmVmb3JlRWFjaCgoKSA9PiB7CiAgIGhhc2hQYXNzd29yZE1v',
    'Y2subW9ja0NsZWFyKCk7CiAgIHZlcmlmeVRvdHBNb2NrLm1vY2tDbGVhcigpOwogICB3cml0ZUF1ZGl0TW9jay5tb2NrUmVzZXQo',
    'KTsKKyAgdHJhbnNhY3Rpb25RdWVyeU1vY2subW9ja1Jlc2V0KCk7CisgIHBvb2xDb25uZWN0TW9jay5tb2NrQ2xlYXIoKTsKIH0p',
    'OwogCiBkZXNjcmliZSgic2VjdXJpdHkgcm91dGUgc2Vzc2lvbiBpbnZhbGlkYXRpb24iLCAoKSA9PiB7CkBAIC0xNDEsMjYgKzE0',
    'NSwyNiBAQCBkZXNjcmliZSgic2VjdXJpdHkgcm91dGUgc2Vzc2lvbiBpbnZhbGlkYXRpb24iLCAoKSA9PiB7CiAgICAgY29uc3Qg',
    'eyBjcmVhdGVIYXNoIH0gPSBhd2FpdCBpbXBvcnQoIm5vZGU6Y3J5cHRvIik7CiAgICAgY29uc3QgdG9rZW5IYXNoID0gY3JlYXRl',
    'SGFzaCgic2hhMjU2IikudXBkYXRlKHRva2VuKS5kaWdlc3QoImhleCIpOwogCi0gICAgcXVlcnlNb2NrCi0gICAgICAubW9ja1Jl',
    'c29sdmVkVmFsdWVPbmNlKHsKLSAgICAgICAgcm93czogW3sKLSAgICAgICAgICBpZDogInJlc2V0LTEiLAotICAgICAgICAgIHVz',
    'ZXJfaWQ6ICJ1c2VyLTEiLAotICAgICAgICAgIGV4cGlyZXNfYXQ6IG5ldyBEYXRlKERhdGUubm93KCkgKyA2MF8wMDApLAotICAg',
    'ICAgICAgIHVzZWRfYXQ6IG51bGwsCi0gICAgICAgIH1dLAotICAgICAgfSkKLSAgICAgIC5tb2NrUmVzb2x2ZWRWYWx1ZU9uY2Uo',
    'eyByb3dzOiBbXSB9KQotICAgICAgLm1vY2tSZXNvbHZlZFZhbHVlT25jZSh7IHJvd3M6IFtdIH0pCi0gICAgICAubW9ja1Jlc29s',
    'dmVkVmFsdWVPbmNlKHsgcm93czogW10gfSk7CisgICAgdHJhbnNhY3Rpb25RdWVyeU1vY2sKKyAgICAgIC5tb2NrUmVzb2x2ZWRW',
    'YWx1ZU9uY2UoeyByb3dzOiBbXSB9KSAvLyBCRUdJTgorICAgICAgLm1vY2tSZXNvbHZlZFZhbHVlT25jZSh7IHJvd3M6IFt7IGlk',
    'OiAicmVzZXQtMSIsIHVzZXJfaWQ6ICJ1c2VyLTEiIH1dIH0pIC8vIGxvY2tlZCB0b2tlbgorICAgICAgLm1vY2tSZXNvbHZlZFZh',
    'bHVlT25jZSh7IHJvd0NvdW50OiAxLCByb3dzOiBbXSB9KSAvLyB1cGRhdGUgcGFzc3dvcmQKKyAgICAgIC5tb2NrUmVzb2x2ZWRW',
    'YWx1ZU9uY2UoeyByb3dDb3VudDogMSwgcm93czogW10gfSkgLy8gY29uc3VtZSB0b2tlbgorICAgICAgLm1vY2tSZXNvbHZlZFZh',
    'bHVlT25jZSh7IHJvd3M6IFtdIH0pIC8vIGF1ZGl0CisgICAgICAubW9ja1Jlc29sdmVkVmFsdWVPbmNlKHsgcm93czogW10gfSk7',
    'IC8vIENPTU1JVAogCiAgICAgYXdhaXQgcmVxdWVzdChidWlsZEFwcCgpKQogICAgICAgLnBvc3QoIi9hcGkvc2VjdXJpdHkvcmVz',
    'ZXQtY29uZmlybSIpCiAgICAgICAuc2VuZCh7IHRva2VuLCBwYXNzd29yZDogIk5ld1Bhc3N3b3JkMTIzIiB9KQogICAgICAgLmV4',
    'cGVjdCgyMDApOwogCi0gICAgZXhwZWN0KHF1ZXJ5TW9jay5tb2NrLmNhbGxzWzFdWzBdKS50b0NvbnRhaW4oInNlc3Npb25fdmVy',
    'c2lvbiA9IHNlc3Npb25fdmVyc2lvbiArIDEiKTsKLSAgICBleHBlY3QocXVlcnlNb2NrLm1vY2suY2FsbHNbMV1bMV0pLnRvRXF1',
    'YWwoWyJoYXNoZWQtTmV3UGFzc3dvcmQxMjMiLCAidXNlci0xIl0pOwotICAgIGV4cGVjdChxdWVyeU1vY2subW9jay5jYWxsc1sw',
    'XVsxXSkudG9FcXVhbChbdG9rZW5IYXNoXSk7CisgICAgZXhwZWN0KHBvb2xDb25uZWN0TW9jaykudG9IYXZlQmVlbkNhbGxlZFRp',
    'bWVzKDEpOworICAgIGV4cGVjdCh0cmFuc2FjdGlvblF1ZXJ5TW9jay5tb2NrLmNhbGxzWzBdWzBdKS50b0JlKCJCRUdJTiIpOwor',
    'ICAgIGV4cGVjdCh0cmFuc2FjdGlvblF1ZXJ5TW9jay5tb2NrLmNhbGxzWzFdWzBdKS50b0NvbnRhaW4oIkZPUiBVUERBVEUiKTsK',
    'KyAgICBleHBlY3QodHJhbnNhY3Rpb25RdWVyeU1vY2subW9jay5jYWxsc1sxXVsxXSkudG9FcXVhbChbdG9rZW5IYXNoXSk7Cisg',
    'ICAgZXhwZWN0KHRyYW5zYWN0aW9uUXVlcnlNb2NrLm1vY2suY2FsbHNbMl1bMF0pLnRvQ29udGFpbigic2Vzc2lvbl92ZXJzaW9u',
    'ID0gc2Vzc2lvbl92ZXJzaW9uICsgMSIpOworICAgIGV4cGVjdCh0cmFuc2FjdGlvblF1ZXJ5TW9jay5tb2NrLmNhbGxzWzJdWzFd',
    'KS50b0VxdWFsKFsiaGFzaGVkLU5ld1Bhc3N3b3JkMTIzIiwgInVzZXItMSJdKTsKKyAgICBleHBlY3QodHJhbnNhY3Rpb25RdWVy',
    'eU1vY2subW9jay5jYWxsc1szXVswXSkudG9Db250YWluKCJ1c2VkX2F0IElTIE5VTEwiKTsKKyAgICBleHBlY3QodHJhbnNhY3Rp',
    'b25RdWVyeU1vY2subW9jay5jYWxsc1s1XVswXSkudG9CZSgiQ09NTUlUIik7CiAgIH0pOwogfSk7CmRpZmYgLS1naXQgYS9zcmMv',
    'Y29tcG9uZW50cy9hZG1pbi9BZG1pbkRhc2hib2FyZC50c3ggYi9zcmMvY29tcG9uZW50cy9hZG1pbi9BZG1pbkRhc2hib2FyZC50',
    'c3gKaW5kZXggMzQ1ZDI5NC4uODE5YmZjNCAxMDA2NDQKLS0tIGEvc3JjL2NvbXBvbmVudHMvYWRtaW4vQWRtaW5EYXNoYm9hcmQu',
    'dHN4CisrKyBiL3NyYy9jb21wb25lbnRzL2FkbWluL0FkbWluRGFzaGJvYXJkLnRzeApAQCAtMjEsMTMgKzIxLDI0IEBAIGZ1bmN0',
    'aW9uIGdlbmVyYXRlVGVtcG9yYXJ5UGFzc3dvcmQoKTogc3RyaW5nIHsKICAgY29uc3QgbG93ZXIgPSAiYWJjZGVmZ2hpamttbm9w',
    'cXJzdHV2d3h5eiI7CiAgIGNvbnN0IHVwcGVyID0gIkFCQ0RFRkdISktMTU5QUVJTVFVWV1hZWiI7CiAgIGNvbnN0IGRpZ2l0cyA9',
    'ICIyMzQ1Njc4OSI7Ci0gIGNvbnN0IHJlc3QgPSBgJHtsb3dlcn0ke3VwcGVyfSR7ZGlnaXRzfWA7Ci0gIGNvbnN0IHBpY2sgPSAo',
    'c291cmNlOiBzdHJpbmcpID0+IHNvdXJjZVtNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBzb3VyY2UubGVuZ3RoKV07Ci0gIGNv',
    'bnN0IGNoYXJhY3RlcnMgPSBbcGljayhsb3dlciksIHBpY2sodXBwZXIpLCBwaWNrKGRpZ2l0cyldOwotICB3aGlsZSAoY2hhcmFj',
    'dGVycy5sZW5ndGggPCAxNikgY2hhcmFjdGVycy5wdXNoKHBpY2socmVzdCkpOwotICByZXR1cm4gY2hhcmFjdGVycwotICAgIC5z',
    'b3J0KCgpID0+IE1hdGgucmFuZG9tKCkgLSAwLjUpCi0gICAgLmpvaW4oIiIpOworICBjb25zdCBhbGwgPSBgJHtsb3dlcn0ke3Vw',
    'cGVyfSR7ZGlnaXRzfWA7CisgIGNvbnN0IGJ5dGVzID0gbmV3IFVpbnQzMkFycmF5KDE2KTsKKyAgY3J5cHRvLmdldFJhbmRvbVZh',
    'bHVlcyhieXRlcyk7CisgIGNvbnN0IGNoYXJhY3RlcnMgPSBbCisgICAgbG93ZXJbYnl0ZXNbMF0gJSBsb3dlci5sZW5ndGhdLAor',
    'ICAgIHVwcGVyW2J5dGVzWzFdICUgdXBwZXIubGVuZ3RoXSwKKyAgICBkaWdpdHNbYnl0ZXNbMl0gJSBkaWdpdHMubGVuZ3RoXSwK',
    'KyAgXTsKKyAgZm9yIChsZXQgaW5kZXggPSAzOyBpbmRleCA8IGJ5dGVzLmxlbmd0aDsgaW5kZXggKz0gMSkgeworICAgIGNoYXJh',
    'Y3RlcnMucHVzaChhbGxbYnl0ZXNbaW5kZXhdICUgYWxsLmxlbmd0aF0pOworICB9CisgIC8vIEZpc2hlci1ZYXRlcyBzaHVmZmxl',
    'OyB0aGUgcGFzc3dvcmQgaXMgZ2VuZXJhdGVkIGxvY2FsbHkgYW5kIGlzIG5ldmVyCisgIC8vIHJldHVybmVkIGJ5IHRoZSBBUEkg',
    'b3IgdHJhbnNtaXR0ZWQgYnkgZW1haWwuCisgIGZvciAobGV0IGluZGV4ID0gY2hhcmFjdGVycy5sZW5ndGggLSAxOyBpbmRleCA+',
    'IDA7IGluZGV4IC09IDEpIHsKKyAgICBjb25zdCBzd2FwSW5kZXggPSBieXRlc1tpbmRleF0gJSAoaW5kZXggKyAxKTsKKyAgICBb',
    'Y2hhcmFjdGVyc1tpbmRleF0sIGNoYXJhY3RlcnNbc3dhcEluZGV4XV0gPSBbY2hhcmFjdGVyc1tzd2FwSW5kZXhdLCBjaGFyYWN0',
    'ZXJzW2luZGV4XV07CisgIH0KKyAgcmV0dXJuIGNoYXJhY3RlcnMuam9pbigiIik7CiB9CiAKIGNvbnN0IHRhYnM6IHsga2V5OiBU',
    'YWI7IGxhYmVsOiBzdHJpbmc7IGVtb2ppPzogc3RyaW5nIH1bXSA9IFsKQEAgLTYwMywxNCArNjE0LDE1IEBAIGV4cG9ydCBkZWZh',
    'dWx0IGZ1bmN0aW9uIEFkbWluRGFzaGJvYXJkKCkgewogICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e2FzeW5j',
    'ICgpID0+IHsKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IEFQSSA9IGltcG9ydC5tZXRhLmVudi5WSVRFX0FQ',
    'SV9VUkwgfHwgIiI7CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0b2tlbiA9IGxvY2FsU3RvcmFnZS5nZXRJ',
    'dGVtKCJhY2Nlc3NUb2tlbiIpOworICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3UGFzc3dvcmQgPSBnZW5l',
    'cmF0ZVRlbXBvcmFyeVBhc3N3b3JkKCk7CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBm',
    'ZXRjaChgJHtBUEl9L2FwaS9hdXRoL3N0YWZmLyR7dXNlci5pZH0vcmVzZXQtcGFzc3dvcmRgLCB7CiAgICAgICAgICAgICAgICAg',
    'ICAgICAgICAgICAgICAgIG1ldGhvZDogIlBPU1QiLAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjcmVkZW50aWFs',
    'czogImluY2x1ZGUiLAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJzOiB7ICJDb250ZW50LVR5cGUiOiAi',
    'YXBwbGljYXRpb24vanNvbiIsIC4uLih0b2tlbiA/IHsgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3Rva2VufWAgfSA6IHt9KSB9',
    'LAotICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7fSksCisgICAgICAgICAgICAg',
    'ICAgICAgICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgcGFzc3dvcmQ6IG5ld1Bhc3N3b3JkIH0pLAogICAgICAg',
    'ICAgICAgICAgICAgICAgICAgICAgICAgfSk7CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkYXRhID0gYXdh',
    'aXQgcmVzLmpzb24oKTsKLSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXMub2spIHRvYXN0LnN1Y2Nlc3MoYE5l',
    'dyBwYXNzd29yZDogJHtkYXRhLnRlbXBvcmFyeVBhc3N3b3JkID8/ICIoZW1haWxlZCkifWApOworICAgICAgICAgICAgICAgICAg',
    'ICAgICAgICAgICAgaWYgKHJlcy5vaykgdG9hc3Quc3VjY2VzcyhgUGFzc3dvcmQgcmVzZXQuIFNoYXJlIHNlY3VyZWx5OiAke25l',
    'd1Bhc3N3b3JkfWApOwogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB0b2FzdC5lcnJvcihkYXRhLmVycm9yIHx8',
    'ICJGYWlsZWQiKTsKICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9fQogICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNs',
    'YXNzTmFtZT0idG91Y2gtdGFyZ2V0IHJvdW5kZWQtbGcgYmctcHJpbWFyeS8xMCBweC0zIHB5LTEgdGV4dC14cyBmb250LXNlbWli',
    'b2xkIHRleHQtcHJpbWFyeSIKQEAgLTY0OSwxNCArNjYxLDE1IEBAIGV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIEFkbWluRGFzaGJv',
    'YXJkKCkgewogICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXthc3luYyAoKSA9PiB7CiAgICAgICAgICAgICAgICAg',
    'ICAgICAgICAgICAgY29uc3QgQVBJID0gaW1wb3J0Lm1ldGEuZW52LlZJVEVfQVBJX1VSTCB8fCAiIjsKICAgICAgICAgICAgICAg',
    'ICAgICAgICAgICAgICBjb25zdCB0b2tlbiA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCJhY2Nlc3NUb2tlbiIpOworICAgICAgICAg',
    'ICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld1Bhc3N3b3JkID0gZ2VuZXJhdGVUZW1wb3JhcnlQYXNzd29yZCgpOwogICAgICAg',
    'ICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGAke0FQSX0vYXBpL2F1dGgvc3RhZmYvJHt1c2Vy',
    'LmlkfS9yZXNldC1wYXNzd29yZGAsIHsKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1ldGhvZDogIlBPU1QiLAogICAg',
    'ICAgICAgICAgICAgICAgICAgICAgICAgICAgY3JlZGVudGlhbHM6ICJpbmNsdWRlIiwKICAgICAgICAgICAgICAgICAgICAgICAg',
    'ICAgICAgIGhlYWRlcnM6IHsgIkNvbnRlbnQtVHlwZSI6ICJhcHBsaWNhdGlvbi9qc29uIiwgLi4uKHRva2VuID8geyBBdXRob3Jp',
    'emF0aW9uOiBgQmVhcmVyICR7dG9rZW59YCB9IDoge30pIH0sCi0gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBib2R5OiBK',
    'U09OLnN0cmluZ2lmeSh7fSksCisgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IHBh',
    'c3N3b3JkOiBuZXdQYXNzd29yZCB9KSwKICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTsKICAgICAgICAgICAgICAgICAg',
    'ICAgICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzLmpzb24oKTsKLSAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAo',
    'cmVzLm9rKSB0b2FzdC5zdWNjZXNzKGBOZXcgcGFzc3dvcmQ6ICR7ZGF0YS50ZW1wb3JhcnlQYXNzd29yZCA/PyAiKGVtYWlsZWQp',
    'In1gKTsKKyAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVzLm9rKSB0b2FzdC5zdWNjZXNzKGBQYXNzd29yZCByZXNl',
    'dC4gU2hhcmUgc2VjdXJlbHk6ICR7bmV3UGFzc3dvcmR9YCk7CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB0b2Fz',
    'dC5lcnJvcihkYXRhLmVycm9yIHx8ICJGYWlsZWQiKTsKICAgICAgICAgICAgICAgICAgICAgICAgICAgfX0KICAgICAgICAgICAg',
    'ICAgICAgICAgICAgICAgY2xhc3NOYW1lPSJ0b3VjaC10YXJnZXQgcm91bmRlZC1sZyBiZy1wcmltYXJ5LzEwIHB4LTMgcHktMSB0',
    'ZXh0LXhzIGZvbnQtc2VtaWJvbGQgdGV4dC1wcmltYXJ5IgpkaWZmIC0tZ2l0IGEvc3JjL3BhZ2VzL0FjY2VwdEludml0ZS50c3gg',
    'Yi9zcmMvcGFnZXMvQWNjZXB0SW52aXRlLnRzeAppbmRleCA1OWQ2OGZmLi40NTI1NTBiIDEwMDY0NAotLS0gYS9zcmMvcGFnZXMv',
    'QWNjZXB0SW52aXRlLnRzeAorKysgYi9zcmMvcGFnZXMvQWNjZXB0SW52aXRlLnRzeApAQCAtMSw0ICsxLDQgQEAKLWltcG9ydCBQ',
    'YXNzd29yZElucHV0IGZyb20gIkAvY29tcG9uZW50cy91aS9QYXNzd29yZElucHV0IjsNCitpbXBvcnQgUGFzc3dvcmRJbnB1dCBm',
    'cm9tICJAL2NvbXBvbmVudHMvdWkvUGFzc3dvcmRJbnB1dCI7CiBpbXBvcnQgeyB1c2VFZmZlY3QsIHVzZVN0YXRlIH0gZnJvbSAi',
    'cmVhY3QiOwogaW1wb3J0IHsgdXNlTmF2aWdhdGUsIHVzZVNlYXJjaFBhcmFtcyB9IGZyb20gInJlYWN0LXJvdXRlci1kb20iOwog',
    'aW1wb3J0IHsgbW90aW9uIH0gZnJvbSAiZnJhbWVyLW1vdGlvbiI7CkBAIC01OCw4ICs1OCw4IEBAIGV4cG9ydCBkZWZhdWx0IGZ1',
    'bmN0aW9uIEFjY2VwdEludml0ZSgpIHsKICAgICAgICAgICAgICAgICBjbGFzc05hbWU9InctZnVsbCByb3VuZGVkLXhsIGJvcmRl',
    'ciBib3JkZXItYm9yZGVyIGJnLWJhY2tncm91bmQgcHgtNCBweS0zIHRleHQtc20gdGV4dC1mb3JlZ3JvdW5kIGZvY3VzOmJvcmRl',
    'ci1wcmltYXJ5IGZvY3VzOnJpbmctMiBmb2N1czpyaW5nLXByaW1hcnkvMjAgb3V0bGluZS1ub25lIiAvPgogICAgICAgICAgICAg',
    'PC9sYWJlbD4KICAgICAgICAgICAgIDxsYWJlbCBjbGFzc05hbWU9ImJsb2NrIj4KLTxzcGFuIGNsYXNzTmFtZT0ibWItMSBibG9j',
    'ayB0ZXh0LXNtIGZvbnQtc2VtaWJvbGQgdGV4dC1mb3JlZ3JvdW5kIj5QYXNzd29yZCAoOCsgY2hhcmFjdGVycyk8L3NwYW4+Ci08',
    'UGFzc3dvcmRJbnB1dCByZXF1aXJlZCBtaW5MZW5ndGg9ezh9IHZhbHVlPXtwYXNzd29yZH0gb25DaGFuZ2U9eyhlKSA9PiBzZXRQ',
    'YXNzd29yZChlLnRhcmdldC52YWx1ZSl9IGF1dG9Db21wbGV0ZT0ibmV3LXBhc3N3b3JkIgorPHNwYW4gY2xhc3NOYW1lPSJtYi0x',
    'IGJsb2NrIHRleHQtc20gZm9udC1zZW1pYm9sZCB0ZXh0LWZvcmVncm91bmQiPlBhc3N3b3JkICgxMisgY2hhcmFjdGVycyk8L3Nw',
    'YW4+Cis8UGFzc3dvcmRJbnB1dCByZXF1aXJlZCBtaW5MZW5ndGg9ezEyfSB2YWx1ZT17cGFzc3dvcmR9IG9uQ2hhbmdlPXsoZSkg',
    'PT4gc2V0UGFzc3dvcmQoZS50YXJnZXQudmFsdWUpfSBhdXRvQ29tcGxldGU9Im5ldy1wYXNzd29yZCIKICAgICAgICAgICAgICAg',
    'ICBjbGFzc05hbWU9InctZnVsbCByb3VuZGVkLXhsIGJvcmRlciBib3JkZXItYm9yZGVyIGJnLWJhY2tncm91bmQgcHgtNCBweS0z',
    'IHRleHQtc20gdGV4dC1mb3JlZ3JvdW5kIGZvY3VzOmJvcmRlci1wcmltYXJ5IGZvY3VzOnJpbmctMiBmb2N1czpyaW5nLXByaW1h',
    'cnkvMjAgb3V0bGluZS1ub25lIiAvPgogICAgICAgICAgICAgPC9sYWJlbD4KICAgICAgICAgICAgIHtzdGF0dXMgPT09ICJlcnJv',
    'ciIgPyA8cCBjbGFzc05hbWU9InRleHQtc20gdGV4dC1kZXN0cnVjdGl2ZSI+e21lc3NhZ2V9PC9wPiA6IG51bGx9Cg=='
)

def run(args, check=True):
    return subprocess.run(args, check=check, text=True, capture_output=True)

def stop(message):
    print("ERROR:", message, file=sys.stderr)
    raise SystemExit(1)

def main():
    root = Path.cwd().resolve()
    if not (root / ".git").exists() or not (root / "package.json").is_file():
        stop("Run from the root of ~/playground-life.")

    head = run(["git", "rev-parse", "HEAD"]).stdout.strip()
    if not head.startswith(EXPECTED_COMMIT):
        stop(f"Expected commit {EXPECTED_COMMIT}, found {head[:12]}. Nothing changed.")

    patch_data = base64.b64decode("".join(PATCH_B64), validate=True)
    patch_hash = hashlib.sha256(patch_data).hexdigest()
    patch_text = patch_data.decode("utf-8")
    touched = sorted({
        line[6:] for line in patch_text.splitlines() if line.startswith("+++ b/")
    })
    if not touched:
        stop("Embedded patch has no target files.")

    # Only refuse if a target file has tracked local edits. Untracked files are
    # deliberately left alone and are never added, removed, or overwritten.
    changed = set(run(["git", "diff", "--name-only", "HEAD"]).stdout.splitlines())
    collisions = sorted(changed.intersection(touched))
    if collisions:
        stop("Tracked edits exist in target files: " + ", ".join(collisions))

    with tempfile.NamedTemporaryFile(prefix="pl-security-", suffix=".patch", delete=False) as f:
        f.write(patch_data)
        patch_path = Path(f.name)

    try:
        check = run(["git", "apply", "--check", str(patch_path)], check=False)
        if check.returncode:
            stop("Patch does not apply cleanly: " + check.stderr.strip())

        for rel in touched:
            if not (root / rel).is_file():
                stop("Required file is missing: " + rel)

        stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        backup_dir = root / ".security-patch-backups" / stamp
        backup_dir.mkdir(parents=True, exist_ok=False)
        manifest_lines = [
            "Base commit: " + head,
            "Patch SHA256: " + patch_hash,
            "Backup timestamp (UTC): " + stamp,
        ]
        for rel in touched:
            src = root / rel
            dst = backup_dir / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            data = src.read_bytes()
            dst.write_bytes(data)
            os.chmod(dst, src.stat().st_mode & 0o777)
            manifest_lines.append(hashlib.sha256(data).hexdigest() + "  " + rel)
        (backup_dir / "MANIFEST.txt").write_text("\n".join(manifest_lines) + "\n", encoding="utf-8")

        applied = run(["git", "apply", str(patch_path)], check=False)
        if applied.returncode:
            for rel in touched:
                (root / rel).write_bytes((backup_dir / rel).read_bytes())
            stop("Apply failed; target files were restored from the backup. " + applied.stderr.strip())

        diff_check = run(["git", "diff", "--check"], check=False)
        if diff_check.returncode:
            for rel in touched:
                (root / rel).write_bytes((backup_dir / rel).read_bytes())
            stop("Post-apply whitespace check failed; target files were restored.")

        print("Password/reset hardening patch applied.")
        print("Backup:", backup_dir)
        print("Changed files:")
        for rel in touched:
            print("  -", rel)
        print("\nReview with: git diff")
        print("Run tests before committing or deploying.")
        print("MFA and CSRF remediation are NOT included in this phase.")
        return 0
    finally:
        patch_path.unlink(missing_ok=True)

if __name__ == "__main__":
    raise SystemExit(main())
