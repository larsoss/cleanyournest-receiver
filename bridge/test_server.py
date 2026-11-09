import unittest
import server


class SecurityTests(unittest.TestCase):
    def test_light_toggle_allowed(self):
        self.assertEqual(server.validate_action({'entity_id':'light.keuken','service':'toggle'}),
                         ('light','toggle',{'entity_id':'light.keuken'}))

    def test_media_volume_allowed(self):
        self.assertEqual(server.validate_action({'entity_id':'media_player.arc','service':'volume_set','value':0.44}),
                         ('media_player','volume_set',{'entity_id':'media_player.arc','volume_level':0.44}))

    def test_reject_unsafe_actions(self):
        for payload in (
            {'entity_id':'alarm_control_panel.verisure_alarm','service':'alarm_disarm'},
            {'entity_id':'person.lars','service':'toggle'},
            {'entity_id':'light.keuken','service':'reload'},
            {'entity_id':'media_player.arc','service':'volume_set','value':100},
            {'entity_id':'light.keuken','service':'toggle','value':100},
            {'entity_id':'light.keuken','service':'toggle','other':'injected'},
        ):
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                server.validate_action(payload)

    def test_private_attributes_are_filtered(self):
        result = server.clean_attributes({'media_title':'Test', 'access_token':'SECRET', 'entity_picture':'/api/camera_proxy/x'})
        self.assertEqual(result, {'media_title':'Test'})


if __name__ == '__main__':
    unittest.main()
