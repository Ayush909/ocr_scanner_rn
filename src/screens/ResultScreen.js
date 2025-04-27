import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';

const ResultScreen = ({route, navigation}) => {
  const {data} = route.params;

  const renderItems = () => {
    return data.items.map((item, index) => (
      <View key={index} style={styles.item}>
        <Text style={styles.itemName}>{item.name}</Text>
        <View style={styles.itemDetails}>
          <Text style={styles.itemText}>Qty: {item.quantity || 'N/A'}</Text>
          <Text style={styles.itemText}>Unit: {item.unit_price || 'N/A'}</Text>
          <Text style={styles.itemText}>
            Total: ${item.total_price || 'N/A'}
          </Text>
        </View>
      </View>
    ));
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.storeName}>{data.store_name}</Text>
        <Text style={styles.storeInfo}>{data.store_address}</Text>
        <Text style={styles.storeInfo}>{data.store_phone}</Text>
      </View>

      <View style={styles.dateSection}>
        <Text style={styles.dateText}>Date: {data.transaction_date}</Text>
        <Text style={styles.dateText}>Time: {data.transaction_time}</Text>
      </View>

      <View style={styles.itemsContainer}>
        <Text style={styles.sectionTitle}>Items</Text>
        {renderItems()}
      </View>

      <View style={styles.totalSection}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal:</Text>
          <Text style={styles.totalValue}>${data.subtotal}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Tax:</Text>
          <Text style={styles.totalValue}>${data.tax}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total:</Text>
          <Text style={styles.totalAmount}>${data.total}</Text>
        </View>
      </View>

      <View style={styles.paymentSection}>
        <Text style={styles.paymentText}>
          Payment Method: {data.payment_method}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('Home')}>
        <Text style={styles.buttonText}>Scan Another Receipt</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  storeName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  storeInfo: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  dateSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  dateText: {
    fontSize: 16,
    color: '#666',
  },
  itemsContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  item: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  itemText: {
    color: '#666',
  },
  totalSection: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
    marginBottom: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 16,
    color: '#666',
  },
  totalValue: {
    fontSize: 16,
    color: '#333',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  paymentSection: {
    marginBottom: 20,
  },
  paymentText: {
    fontSize: 16,
    color: '#666',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ResultScreen;
