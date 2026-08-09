package wechatv2

import (
	"encoding/xml"
	"fmt"
	"io"
	"sort"
	"strings"
)

type Values map[string]string

func (values Values) MarshalXML(encoder *xml.Encoder, start xml.StartElement) error {
	start.Name.Local = "xml"
	if err := encoder.EncodeToken(start); err != nil {
		return err
	}
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		if strings.TrimSpace(key) == "" {
			return fmt.Errorf("empty XML field name")
		}
		element := xml.StartElement{Name: xml.Name{Local: key}}
		if err := encoder.EncodeElement(values[key], element); err != nil {
			return err
		}
	}
	return encoder.EncodeToken(start.End())
}

func (values *Values) UnmarshalXML(decoder *xml.Decoder, start xml.StartElement) error {
	if start.Name.Local != "xml" {
		return fmt.Errorf("unexpected XML root %q", start.Name.Local)
	}
	result := make(Values)
	for {
		token, err := decoder.Token()
		if err != nil {
			if err == io.EOF {
				return fmt.Errorf("unexpected end of XML")
			}
			return err
		}
		switch typed := token.(type) {
		case xml.StartElement:
			var value string
			if err := decoder.DecodeElement(&value, &typed); err != nil {
				return err
			}
			result[typed.Name.Local] = value
		case xml.EndElement:
			if typed.Name == start.Name {
				*values = result
				return nil
			}
		}
	}
}
