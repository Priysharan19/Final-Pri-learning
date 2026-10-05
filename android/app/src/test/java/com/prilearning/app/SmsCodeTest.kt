package com.prilearning.app

import com.prilearning.app.auth.SmsCode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SmsCodeTest {
    @Test fun takesTheStandaloneSixDigitCode() {
        assertEquals("482913", SmsCode.extract("482913 is your Pri Learning code. It expires in 10 minutes."))
        assertEquals("004211", SmsCode.extract("Your Pri code: 004211\n@pri.example #004211"))
    }

    @Test fun neverTakesPartOfALongerNumber() {
        assertNull(SmsCode.extract("Call 98765432101 for help"))
        assertNull(SmsCode.extract("Code 12345"))
        assertEquals("123456", SmsCode.extract("Ref 1234567, code 123456"))
    }

    @Test fun pageWaitsLongerThanPlayServices() {
        // A consent sheet tapped after Play services' 5-minute window must still find the page waiting.
        assertEquals(5 * 60 * 1000L, SmsCode.NATIVE_WAIT_MS)
        assertTrue(SmsCode.PAGE_WAIT_MS > SmsCode.NATIVE_WAIT_MS)
    }

    @Test fun nothingInNothingOut() {
        assertNull(SmsCode.extract(null))
        assertNull(SmsCode.extract(""))
    }
}
