use regex::Regex;
use std::collections::HashMap;

pub fn parse_xml(xml: &str) -> HashMap<String, String> {
    let regex = Regex::new(r"<([^>/]+)>(?:<!\[CDATA\[(.*?)\]\]>|([^<]*))</[^>]+>").unwrap();
    regex
        .captures_iter(xml)
        .map(|captures| {
            let key = captures.get(1).map(|m| m.as_str()).unwrap_or_default();
            let cdata_value = captures.get(2).map(|m| m.as_str());
            let normal_value = captures.get(3).map(|m| m.as_str());
            (
                key.to_string(),
                cdata_value.or(normal_value).unwrap_or_default().to_string(),
            )
        })
        .collect()
}

pub fn build_xml(entries: &[(&str, &str)]) -> String {
    let mut xml = String::from("<xml>");
    for (key, value) in entries {
        xml.push_str(&format!("<{key}><![CDATA[{value}]]></{key}>"));
    }
    xml.push_str("</xml>");
    xml
}
